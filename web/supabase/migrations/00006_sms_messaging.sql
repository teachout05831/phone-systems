-- ============================================
-- SMS MESSAGING TABLES
-- Version: 1.0
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. SMS CONVERSATIONS (thread per contact)
-- ============================================

CREATE TABLE public.sms_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,

  -- Phone number for conversation (in case contact is deleted)
  phone_number TEXT NOT NULL,

  -- Denormalized for fast list display
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_count INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'blocked')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One conversation per phone number per company
  UNIQUE(company_id, phone_number)
);

CREATE INDEX idx_sms_conversations_company ON public.sms_conversations(company_id);
CREATE INDEX idx_sms_conversations_contact ON public.sms_conversations(contact_id);
CREATE INDEX idx_sms_conversations_phone ON public.sms_conversations(phone_number);
CREATE INDEX idx_sms_conversations_last_message ON public.sms_conversations(last_message_at DESC);
CREATE INDEX idx_sms_conversations_status ON public.sms_conversations(status);

-- ============================================
-- 2. SMS MESSAGES
-- ============================================

CREATE TABLE public.sms_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.sms_conversations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,

  -- Direction and participants
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,

  -- Content
  body TEXT NOT NULL,

  -- Twilio tracking
  twilio_sid TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'queued', 'sending', 'sent', 'delivered', 'failed', 'undelivered', 'received'
  )),
  error_code TEXT,
  error_message TEXT,

  -- Timestamps
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,

  -- Who sent it (null for inbound or AI-sent)
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sms_messages_conversation ON public.sms_messages(conversation_id);
CREATE INDEX idx_sms_messages_company ON public.sms_messages(company_id);
CREATE INDEX idx_sms_messages_contact ON public.sms_messages(contact_id);
CREATE INDEX idx_sms_messages_twilio_sid ON public.sms_messages(twilio_sid);
CREATE INDEX idx_sms_messages_created ON public.sms_messages(created_at DESC);
CREATE INDEX idx_sms_messages_direction ON public.sms_messages(direction);

-- ============================================
-- 3. SMS TEMPLATES (quick replies)
-- ============================================

CREATE TABLE public.sms_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Template content
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT DEFAULT 'general' CHECK (category IN (
    'general', 'followup', 'appointment', 'reminder', 'greeting', 'closing'
  )),

  -- Usage tracking
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique name per company
  UNIQUE(company_id, name)
);

CREATE INDEX idx_sms_templates_company ON public.sms_templates(company_id);
CREATE INDEX idx_sms_templates_category ON public.sms_templates(category);

-- ============================================
-- 4. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.sms_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

-- SMS Conversations (simplified policies matching existing pattern)
CREATE POLICY "sms_conversations - select" ON public.sms_conversations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "sms_conversations - insert" ON public.sms_conversations
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sms_conversations - update" ON public.sms_conversations
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "sms_conversations - delete" ON public.sms_conversations
  FOR DELETE TO authenticated USING (true);

-- SMS Messages (simplified policies matching existing pattern)
CREATE POLICY "sms_messages - select" ON public.sms_messages
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "sms_messages - insert" ON public.sms_messages
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sms_messages - update" ON public.sms_messages
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "sms_messages - delete" ON public.sms_messages
  FOR DELETE TO authenticated USING (true);

-- SMS Templates (simplified policies matching existing pattern)
CREATE POLICY "sms_templates - select" ON public.sms_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "sms_templates - insert" ON public.sms_templates
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sms_templates - update" ON public.sms_templates
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "sms_templates - delete" ON public.sms_templates
  FOR DELETE TO authenticated USING (true);

-- ============================================
-- 5. TRIGGERS FOR DENORMALIZED DATA
-- ============================================

-- Update conversation stats when message is added
CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.sms_conversations
  SET
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.body, 100),
    message_count = message_count + 1,
    unread_count = CASE
      WHEN NEW.direction = 'inbound' THEN unread_count + 1
      ELSE unread_count
    END,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_sms_message_created
  AFTER INSERT ON public.sms_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_on_message();

-- Update template use count
CREATE OR REPLACE FUNCTION public.increment_template_use()
RETURNS TRIGGER AS $$
BEGIN
  -- This would be called from application when template is used
  UPDATE public.sms_templates
  SET
    use_count = use_count + 1,
    last_used_at = NOW()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. HELPER FUNCTIONS
-- ============================================

-- Get or create conversation for a phone number
CREATE OR REPLACE FUNCTION public.get_or_create_sms_conversation(
  p_company_id UUID,
  p_phone_number TEXT,
  p_contact_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  -- Try to find existing conversation
  SELECT id INTO v_conversation_id
  FROM public.sms_conversations
  WHERE company_id = p_company_id AND phone_number = p_phone_number;

  -- Create if not exists
  IF v_conversation_id IS NULL THEN
    INSERT INTO public.sms_conversations (company_id, phone_number, contact_id)
    VALUES (p_company_id, p_phone_number, p_contact_id)
    RETURNING id INTO v_conversation_id;
  END IF;

  RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark conversation as read
CREATE OR REPLACE FUNCTION public.mark_conversation_read(
  p_conversation_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.sms_conversations
  SET unread_count = 0, updated_at = NOW()
  WHERE id = p_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- DONE! SMS schema created successfully.
-- ============================================
