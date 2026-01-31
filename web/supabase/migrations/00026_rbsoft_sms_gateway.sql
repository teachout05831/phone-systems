-- =============================================
-- RBSOFT SMS GATEWAY INTEGRATION
-- Version: 1.0
-- Description: Add RBsoft SMS Gateway as a second provider alongside Twilio
-- =============================================

-- =============================================
-- RBSOFT COMPANY SETTINGS
-- =============================================

ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS rbsoft_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS rbsoft_api_url TEXT,
ADD COLUMN IF NOT EXISTS rbsoft_api_key TEXT,
ADD COLUMN IF NOT EXISTS rbsoft_webhook_secret TEXT;

-- =============================================
-- RBSOFT DEVICES (per company, multiple allowed)
-- =============================================

CREATE TABLE IF NOT EXISTS public.rbsoft_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Device identification
  device_id TEXT NOT NULL,           -- RBsoft device ID
  name TEXT NOT NULL,                -- Friendly name ("Sales Phone")
  phone_number TEXT,                 -- The SIM's phone number

  -- Status tracking
  is_active BOOLEAN DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  status TEXT DEFAULT 'unknown',     -- 'online', 'offline', 'unknown'

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(company_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_rbsoft_devices_company ON public.rbsoft_devices(company_id);
CREATE INDEX IF NOT EXISTS idx_rbsoft_devices_active ON public.rbsoft_devices(company_id, is_active);

-- =============================================
-- RBSOFT CALL LOG (view calls from phones)
-- =============================================

CREATE TABLE IF NOT EXISTS public.rbsoft_call_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.rbsoft_devices(id) ON DELETE SET NULL,

  -- Call details
  direction TEXT NOT NULL,           -- 'inbound', 'outbound', 'missed'
  phone_number TEXT NOT NULL,        -- The other party's number
  duration_seconds INTEGER DEFAULT 0,
  call_type TEXT,                    -- 'voice', 'video'

  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,

  -- Sync tracking
  rbsoft_call_id TEXT,               -- RBsoft's internal ID
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rbsoft_call_log_company ON public.rbsoft_call_log(company_id);
CREATE INDEX IF NOT EXISTS idx_rbsoft_call_log_device ON public.rbsoft_call_log(device_id);
CREATE INDEX IF NOT EXISTS idx_rbsoft_call_log_phone ON public.rbsoft_call_log(phone_number);
CREATE INDEX IF NOT EXISTS idx_rbsoft_call_log_started ON public.rbsoft_call_log(started_at DESC);

-- =============================================
-- SMS BLACKLIST (blocked numbers)
-- =============================================

CREATE TABLE IF NOT EXISTS public.sms_blacklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  phone_number TEXT NOT NULL,
  reason TEXT,                       -- 'unsubscribed', 'manual', 'bounced'
  source TEXT,                       -- 'STOP keyword', 'admin', 'system'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),

  UNIQUE(company_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_sms_blacklist_company ON public.sms_blacklist(company_id);
CREATE INDEX IF NOT EXISTS idx_sms_blacklist_phone ON public.sms_blacklist(phone_number);

-- =============================================
-- SCHEDULED MESSAGES
-- =============================================

CREATE TABLE IF NOT EXISTS public.sms_scheduled (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.sms_conversations(id) ON DELETE CASCADE,

  -- Message content
  to_number TEXT NOT NULL,
  body TEXT NOT NULL,
  media_url TEXT,                    -- For MMS

  -- Scheduling
  scheduled_for TIMESTAMPTZ NOT NULL,
  timezone TEXT DEFAULT 'America/New_York',

  -- Status
  status TEXT DEFAULT 'pending',     -- 'pending', 'sent', 'failed', 'cancelled'
  sent_at TIMESTAMPTZ,
  error_message TEXT,

  -- Provider preference
  preferred_provider TEXT,           -- 'rbsoft', 'twilio', NULL (auto)
  device_id UUID REFERENCES public.rbsoft_devices(id),

  -- Tracking
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_scheduled_company ON public.sms_scheduled(company_id);
CREATE INDEX IF NOT EXISTS idx_sms_scheduled_pending ON public.sms_scheduled(status, scheduled_for)
  WHERE status = 'pending';

-- =============================================
-- EXTEND SMS_MESSAGES FOR PROVIDER TRACKING
-- =============================================

ALTER TABLE public.sms_messages
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'twilio',
ADD COLUMN IF NOT EXISTS provider_device_id UUID REFERENCES public.rbsoft_devices(id),
ADD COLUMN IF NOT EXISTS media_url TEXT;

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.rbsoft_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbsoft_call_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_scheduled ENABLE ROW LEVEL SECURITY;

-- Devices - Select
DROP POLICY IF EXISTS "rbsoft_devices_select" ON public.rbsoft_devices;
CREATE POLICY "rbsoft_devices_select" ON public.rbsoft_devices FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

-- Devices - Manage (insert/update/delete for admins)
DROP POLICY IF EXISTS "rbsoft_devices_insert" ON public.rbsoft_devices;
CREATE POLICY "rbsoft_devices_insert" ON public.rbsoft_devices FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM public.company_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

DROP POLICY IF EXISTS "rbsoft_devices_update" ON public.rbsoft_devices;
CREATE POLICY "rbsoft_devices_update" ON public.rbsoft_devices FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM public.company_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

DROP POLICY IF EXISTS "rbsoft_devices_delete" ON public.rbsoft_devices;
CREATE POLICY "rbsoft_devices_delete" ON public.rbsoft_devices FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM public.company_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- Call Log - Select only
DROP POLICY IF EXISTS "rbsoft_call_log_select" ON public.rbsoft_call_log;
CREATE POLICY "rbsoft_call_log_select" ON public.rbsoft_call_log FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

-- Call Log - Insert (for webhook/sync)
DROP POLICY IF EXISTS "rbsoft_call_log_insert" ON public.rbsoft_call_log;
CREATE POLICY "rbsoft_call_log_insert" ON public.rbsoft_call_log FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

-- Blacklist - Select
DROP POLICY IF EXISTS "sms_blacklist_select" ON public.sms_blacklist;
CREATE POLICY "sms_blacklist_select" ON public.sms_blacklist FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

-- Blacklist - Manage
DROP POLICY IF EXISTS "sms_blacklist_insert" ON public.sms_blacklist;
CREATE POLICY "sms_blacklist_insert" ON public.sms_blacklist FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM public.company_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
  ));

DROP POLICY IF EXISTS "sms_blacklist_update" ON public.sms_blacklist;
CREATE POLICY "sms_blacklist_update" ON public.sms_blacklist FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM public.company_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
  ));

DROP POLICY IF EXISTS "sms_blacklist_delete" ON public.sms_blacklist;
CREATE POLICY "sms_blacklist_delete" ON public.sms_blacklist FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM public.company_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
  ));

-- Scheduled Messages - Select
DROP POLICY IF EXISTS "sms_scheduled_select" ON public.sms_scheduled;
CREATE POLICY "sms_scheduled_select" ON public.sms_scheduled FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

-- Scheduled Messages - Manage
DROP POLICY IF EXISTS "sms_scheduled_insert" ON public.sms_scheduled;
CREATE POLICY "sms_scheduled_insert" ON public.sms_scheduled FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "sms_scheduled_update" ON public.sms_scheduled;
CREATE POLICY "sms_scheduled_update" ON public.sms_scheduled FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "sms_scheduled_delete" ON public.sms_scheduled;
CREATE POLICY "sms_scheduled_delete" ON public.sms_scheduled FOR DELETE
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON COLUMN public.company_settings.rbsoft_enabled IS 'When true, RBsoft SMS gateway is active for this company';
COMMENT ON COLUMN public.company_settings.rbsoft_api_url IS 'Base URL for the RBsoft API (e.g., https://your-rbsoft-server.com/api)';
COMMENT ON COLUMN public.company_settings.rbsoft_api_key IS 'API key for authenticating with RBsoft';
COMMENT ON COLUMN public.company_settings.rbsoft_webhook_secret IS 'Secret for validating incoming RBsoft webhooks';

COMMENT ON TABLE public.rbsoft_devices IS 'RBsoft devices (phones) registered for SMS sending per company';
COMMENT ON TABLE public.rbsoft_call_log IS 'Call history synced from RBsoft devices';
COMMENT ON TABLE public.sms_blacklist IS 'Blocked phone numbers that should not receive SMS messages';
COMMENT ON TABLE public.sms_scheduled IS 'Scheduled SMS messages to be sent at a specific time';

-- =============================================
-- DONE! RBsoft SMS Gateway schema created.
-- =============================================
