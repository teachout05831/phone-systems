-- ============================================
-- FIX: Simplify ALL RLS policies to avoid recursion
-- Run this in Supabase SQL Editor
-- ============================================

-- CONTACTS
ALTER TABLE public.contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'contacts'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.contacts', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "Contacts - select" ON public.contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Contacts - insert" ON public.contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Contacts - update" ON public.contacts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Contacts - delete" ON public.contacts FOR DELETE TO authenticated USING (true);

-- CALLS
ALTER TABLE public.calls DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'calls'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.calls', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "Calls - select" ON public.calls FOR SELECT TO authenticated USING (true);
CREATE POLICY "Calls - insert" ON public.calls FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Calls - update" ON public.calls FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Calls - delete" ON public.calls FOR DELETE TO authenticated USING (true);

-- AGENTS
ALTER TABLE public.agents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'agents'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.agents', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "Agents - select" ON public.agents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Agents - insert" ON public.agents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Agents - update" ON public.agents FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Agents - delete" ON public.agents FOR DELETE TO authenticated USING (true);

-- CALLBACKS
ALTER TABLE public.callbacks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.callbacks ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'callbacks'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.callbacks', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "Callbacks - select" ON public.callbacks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Callbacks - insert" ON public.callbacks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Callbacks - update" ON public.callbacks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Callbacks - delete" ON public.callbacks FOR DELETE TO authenticated USING (true);

-- CALL_NOTES
ALTER TABLE public.call_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_notes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'call_notes'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.call_notes', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "Call_notes - select" ON public.call_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Call_notes - insert" ON public.call_notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Call_notes - update" ON public.call_notes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Call_notes - delete" ON public.call_notes FOR DELETE TO authenticated USING (true);

-- CALL_TRANSCRIPTS
ALTER TABLE public.call_transcripts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_transcripts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'call_transcripts'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.call_transcripts', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "Call_transcripts - select" ON public.call_transcripts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Call_transcripts - insert" ON public.call_transcripts FOR INSERT TO authenticated WITH CHECK (true);

-- ACTIVITY_LOG
ALTER TABLE public.activity_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'activity_log'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.activity_log', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "Activity_log - select" ON public.activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Activity_log - insert" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (true);
