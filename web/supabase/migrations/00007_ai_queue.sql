-- AI Queue table for batch AI agent calling
-- Migration: 00007_ai_queue.sql

CREATE TABLE public.ai_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,

  -- Queue status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_progress', 'completed', 'failed', 'cancelled', 'retry_scheduled'
  )),

  -- Priority: 1 = high, 2 = normal
  priority INTEGER DEFAULT 2 CHECK (priority IN (1, 2)),

  -- Attempt tracking
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,

  -- Call outcome (set when completed)
  outcome TEXT CHECK (outcome IS NULL OR outcome IN (
    'booked', 'callback', 'not_interested', 'no_answer', 'wrong_number', 'voicemail'
  )),

  -- Optional notes
  notes TEXT,

  -- Scheduling
  scheduled_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_ai_queue_company ON public.ai_queue(company_id);
CREATE INDEX idx_ai_queue_status ON public.ai_queue(status);
CREATE INDEX idx_ai_queue_priority ON public.ai_queue(priority);
CREATE INDEX idx_ai_queue_created ON public.ai_queue(created_at DESC);
CREATE INDEX idx_ai_queue_scheduled ON public.ai_queue(scheduled_at);
CREATE INDEX idx_ai_queue_contact ON public.ai_queue(contact_id);

-- Composite index for queue processing (pending items, ordered by priority)
CREATE INDEX idx_ai_queue_pending ON public.ai_queue(company_id, status, priority, created_at)
  WHERE status IN ('pending', 'retry_scheduled');

-- Row Level Security
ALTER TABLE public.ai_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies (following existing pattern from 00005_fix_all_rls.sql)
CREATE POLICY "ai_queue_select" ON public.ai_queue
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ai_queue_insert" ON public.ai_queue
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "ai_queue_update" ON public.ai_queue
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "ai_queue_delete" ON public.ai_queue
  FOR DELETE TO authenticated USING (true);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_queue_updated_at
  BEFORE UPDATE ON public.ai_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_queue_updated_at();
