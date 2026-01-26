-- ============================================
-- OUTREACH SYSTEM DATABASE SCHEMA
-- Version: 1.0
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PROFILES (extends Supabase Auth)
-- ============================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'rep' CHECK (role IN ('admin', 'manager', 'rep', 'closer')),
  phone_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. COMPANIES / WORKSPACES
-- ============================================

CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Company membership
CREATE TABLE public.company_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

-- ============================================
-- 3. AGENTS (AI Agent configs per company)
-- ============================================

CREATE TABLE public.agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Agent identity
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('voice_agent', 'assistant', 'coach')),
  role TEXT,
  description TEXT,

  -- Configuration (JSONB for flexibility)
  llm_config JSONB DEFAULT '{}',
  voice_config JSONB DEFAULT '{}',
  behavior_config JSONB DEFAULT '{}',
  prompt TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(company_id, slug)
);

-- ============================================
-- 4. CONTACTS / LEADS
-- ============================================

CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Basic info
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT NOT NULL,
  phone_secondary TEXT,

  -- Business info
  business_name TEXT,
  job_title TEXT,
  website TEXT,

  -- Lead management
  status TEXT DEFAULT 'new' CHECK (status IN (
    'new', 'contacted', 'engaged', 'qualified',
    'nurturing', 'closed_won', 'closed_lost', 'do_not_contact'
  )),

  -- Source tracking
  source TEXT,
  source_details JSONB DEFAULT '{}',

  -- Tags and notes
  tags TEXT[] DEFAULT '{}',
  notes TEXT,

  -- Timestamps
  last_contacted_at TIMESTAMPTZ,
  next_followup_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contacts_phone ON public.contacts(phone);
CREATE INDEX idx_contacts_company ON public.contacts(company_id);
CREATE INDEX idx_contacts_status ON public.contacts(status);

-- ============================================
-- 5. CALLS
-- ============================================

CREATE TABLE public.calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  rep_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,

  -- Call identifiers
  external_call_id TEXT,

  -- Call details
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  phone_number TEXT NOT NULL,
  from_number TEXT,

  -- Status and timing
  status TEXT DEFAULT 'initiated' CHECK (status IN (
    'initiated', 'ringing', 'in_progress', 'completed',
    'missed', 'no_answer', 'busy', 'failed', 'voicemail'
  )),

  started_at TIMESTAMPTZ DEFAULT NOW(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,

  -- Outcome
  outcome TEXT CHECK (outcome IN (
    'booked', 'callback', 'interested', 'not_interested',
    'wrong_number', 'do_not_call', 'voicemail_left', 'no_outcome'
  )),

  -- Recording
  has_recording BOOLEAN DEFAULT FALSE,
  recording_url TEXT,
  recording_duration_seconds INTEGER,

  -- AI-generated data
  ai_summary JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calls_company ON public.calls(company_id);
CREATE INDEX idx_calls_contact ON public.calls(contact_id);
CREATE INDEX idx_calls_rep ON public.calls(rep_id);
CREATE INDEX idx_calls_started_at ON public.calls(started_at DESC);
CREATE INDEX idx_calls_external_id ON public.calls(external_call_id);

-- ============================================
-- 6. CALL TRANSCRIPTS
-- ============================================

CREATE TABLE public.call_transcripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID REFERENCES public.calls(id) ON DELETE CASCADE,

  -- Transcript segments: [{speaker, text, timestamp}]
  segments JSONB NOT NULL DEFAULT '[]',

  -- Full text for search
  full_text TEXT,

  -- Metadata
  word_count INTEGER,
  duration_seconds INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transcripts_call ON public.call_transcripts(call_id);

-- ============================================
-- 7. CALL NOTES (Ralph Handoff Notes)
-- ============================================

CREATE TABLE public.call_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID REFERENCES public.calls(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Note content
  note_type TEXT DEFAULT 'general' CHECK (note_type IN (
    'general', 'handoff', 'objection', 'interest', 'followup', 'ai_insight'
  )),

  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  is_pinned BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notes_call ON public.call_notes(call_id);
CREATE INDEX idx_notes_contact ON public.call_notes(contact_id);
CREATE INDEX idx_notes_type ON public.call_notes(note_type);

-- ============================================
-- 8. CALLBACKS
-- ============================================

CREATE TABLE public.callbacks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  original_call_id UUID REFERENCES public.calls(id) ON DELETE SET NULL,

  -- Scheduling
  scheduled_at TIMESTAMPTZ NOT NULL,
  reminder_at TIMESTAMPTZ,

  -- Status
  status TEXT DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'pending', 'in_progress', 'completed', 'rescheduled', 'cancelled', 'exhausted'
  )),

  -- Attempt tracking
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  attempt_history JSONB DEFAULT '[]',

  -- Context
  reason TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),

  -- Resolution
  completed_at TIMESTAMPTZ,
  completed_call_id UUID REFERENCES public.calls(id) ON DELETE SET NULL,
  resolution_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_callbacks_company ON public.callbacks(company_id);
CREATE INDEX idx_callbacks_contact ON public.callbacks(contact_id);
CREATE INDEX idx_callbacks_assigned ON public.callbacks(assigned_to);
CREATE INDEX idx_callbacks_scheduled ON public.callbacks(scheduled_at);
CREATE INDEX idx_callbacks_status ON public.callbacks(status);

-- ============================================
-- 9. ACTIVITY LOG
-- ============================================

CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Activity details
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'call_outbound', 'call_inbound', 'call_missed', 'voicemail_left',
    'callback_scheduled', 'callback_completed', 'note_added',
    'status_changed', 'email_sent', 'sms_sent', 'contact_created', 'contact_updated'
  )),

  description TEXT,

  -- Related entities
  related_call_id UUID REFERENCES public.calls(id) ON DELETE SET NULL,
  related_callback_id UUID REFERENCES public.callbacks(id) ON DELETE SET NULL,

  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_company ON public.activity_log(company_id);
CREATE INDEX idx_activity_contact ON public.activity_log(contact_id);
CREATE INDEX idx_activity_created ON public.activity_log(created_at DESC);

-- ============================================
-- 10. ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.callbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Profile policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Company policies
CREATE POLICY "Users can view their companies"
  ON public.companies FOR SELECT
  USING (
    id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create companies"
  ON public.companies FOR INSERT
  WITH CHECK (true);

-- Company members policies
CREATE POLICY "Users can view company members"
  ON public.company_members FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can add company members"
  ON public.company_members FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ) OR NOT EXISTS (SELECT 1 FROM public.company_members WHERE company_id = company_members.company_id)
  );

-- Agents policies
CREATE POLICY "Users can view company agents"
  ON public.agents FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage company agents"
  ON public.agents FOR ALL
  USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

-- Contacts policies
CREATE POLICY "Users can view company contacts"
  ON public.contacts FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage company contacts"
  ON public.contacts FOR ALL
  USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

-- Calls policies
CREATE POLICY "Users can view company calls"
  ON public.calls FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage company calls"
  ON public.calls FOR ALL
  USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

-- Call transcripts policies
CREATE POLICY "Users can view call transcripts"
  ON public.call_transcripts FOR SELECT
  USING (
    call_id IN (
      SELECT id FROM public.calls WHERE company_id IN (
        SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage call transcripts"
  ON public.call_transcripts FOR ALL
  USING (
    call_id IN (
      SELECT id FROM public.calls WHERE company_id IN (
        SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
      )
    )
  );

-- Call notes policies
CREATE POLICY "Users can view company call notes"
  ON public.call_notes FOR SELECT
  USING (
    contact_id IN (
      SELECT id FROM public.contacts WHERE company_id IN (
        SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage company call notes"
  ON public.call_notes FOR ALL
  USING (
    contact_id IN (
      SELECT id FROM public.contacts WHERE company_id IN (
        SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
      )
    )
  );

-- Callbacks policies
CREATE POLICY "Users can view company callbacks"
  ON public.callbacks FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage company callbacks"
  ON public.callbacks FOR ALL
  USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

-- Activity log policies
CREATE POLICY "Users can view company activity"
  ON public.activity_log FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can log company activity"
  ON public.activity_log FOR INSERT
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

-- ============================================
-- 11. HELPER FUNCTIONS
-- ============================================

-- Get contact by phone number (for Ralph)
CREATE OR REPLACE FUNCTION public.get_contact_by_phone(
  p_company_id UUID,
  p_phone TEXT
)
RETURNS public.contacts AS $$
DECLARE
  v_contact public.contacts;
BEGIN
  SELECT * INTO v_contact
  FROM public.contacts
  WHERE company_id = p_company_id
    AND (phone = p_phone OR phone_secondary = p_phone)
  LIMIT 1;

  RETURN v_contact;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log activity helper
CREATE OR REPLACE FUNCTION public.log_activity(
  p_company_id UUID,
  p_contact_id UUID,
  p_user_id UUID,
  p_activity_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.activity_log (
    company_id, contact_id, user_id, activity_type, description, metadata
  ) VALUES (
    p_company_id, p_contact_id, p_user_id, p_activity_type, p_description, p_metadata
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- DONE! Schema created successfully.
-- ============================================
