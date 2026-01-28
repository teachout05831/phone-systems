-- =====================================================
-- Migration: Rep Time Tracking System
-- Adds session tracking, events logging, and company settings
-- for sales rep productivity
-- =====================================================

-- =====================================================
-- 1. REP SESSIONS TABLE
-- Tracks individual working sessions for sales reps
-- =====================================================
CREATE TABLE IF NOT EXISTS public.rep_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  rep_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),

  -- Aggregated metrics (in seconds)
  total_duration_seconds INTEGER NOT NULL DEFAULT 0,
  talk_time_seconds INTEGER NOT NULL DEFAULT 0,
  idle_time_seconds INTEGER NOT NULL DEFAULT 0,
  break_time_seconds INTEGER NOT NULL DEFAULT 0,

  -- Call metrics
  total_calls INTEGER NOT NULL DEFAULT 0,
  connected_calls INTEGER NOT NULL DEFAULT 0,
  booked_calls INTEGER NOT NULL DEFAULT 0,

  -- Break tracking
  break_count INTEGER NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_rep_sessions_rep_id ON public.rep_sessions(rep_id);
CREATE INDEX IF NOT EXISTS idx_rep_sessions_company_id ON public.rep_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_rep_sessions_status ON public.rep_sessions(status);
CREATE INDEX IF NOT EXISTS idx_rep_sessions_started_at ON public.rep_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_rep_sessions_rep_status ON public.rep_sessions(rep_id, status);

-- =====================================================
-- 2. REP SESSION EVENTS TABLE
-- Granular event log for detailed analysis
-- =====================================================
CREATE TABLE IF NOT EXISTS public.rep_session_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.rep_sessions(id) ON DELETE CASCADE NOT NULL,
  rep_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Event details
  event_type TEXT NOT NULL CHECK (event_type IN (
    'session_start', 'session_end', 'session_pause', 'session_resume',
    'call_start', 'call_end', 'call_connected',
    'break_detected', 'break_ended', 'activity_ping'
  )),

  -- Event metadata (optional)
  call_sid TEXT,
  contact_id UUID,
  duration_seconds INTEGER,
  metadata JSONB DEFAULT '{}',

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_rep_session_events_session_id ON public.rep_session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_rep_session_events_rep_id ON public.rep_session_events(rep_id);
CREATE INDEX IF NOT EXISTS idx_rep_session_events_event_type ON public.rep_session_events(event_type);
CREATE INDEX IF NOT EXISTS idx_rep_session_events_created_at ON public.rep_session_events(created_at DESC);

-- =====================================================
-- 3. ADD TIME TRACKING SETTINGS TO COMPANY_SETTINGS
-- =====================================================
-- First check if company_settings table exists, if not create it
CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE UNIQUE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add specific time tracking columns
ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS break_detection_enabled BOOLEAN DEFAULT false;

ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS break_detection_minutes INTEGER DEFAULT 5;

ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS daily_report_time TEXT DEFAULT '23:59';

ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS time_tracking_enabled BOOLEAN DEFAULT true;

-- =====================================================
-- 4. DAILY STATS VIEW
-- Aggregated daily statistics for reporting dashboards
-- =====================================================
CREATE OR REPLACE VIEW public.rep_daily_stats AS
SELECT
  rep_id,
  company_id,
  DATE(started_at AT TIME ZONE 'UTC') as date,
  COUNT(*) as session_count,
  SUM(total_calls) as total_calls,
  SUM(connected_calls) as connected_calls,
  SUM(booked_calls) as booked_calls,
  SUM(talk_time_seconds) as talk_time_seconds,
  SUM(idle_time_seconds) as idle_time_seconds,
  SUM(break_time_seconds) as break_time_seconds,
  SUM(total_duration_seconds) as total_duration_seconds,
  CASE
    WHEN SUM(total_duration_seconds) > 0
    THEN ROUND((SUM(talk_time_seconds)::numeric / SUM(total_duration_seconds)::numeric) * 100, 1)
    ELSE 0
  END as talk_percentage,
  CASE
    WHEN SUM(total_duration_seconds) > 0
    THEN ROUND((SUM(total_calls)::numeric / (SUM(total_duration_seconds)::numeric / 3600)), 1)
    ELSE 0
  END as calls_per_hour
FROM public.rep_sessions
WHERE status = 'completed'
GROUP BY rep_id, company_id, DATE(started_at AT TIME ZONE 'UTC');

-- =====================================================
-- 5. RLS POLICIES
-- =====================================================

-- Enable RLS on rep_sessions
ALTER TABLE public.rep_sessions ENABLE ROW LEVEL SECURITY;

-- Reps can view their own sessions
CREATE POLICY "Users can view own sessions"
  ON public.rep_sessions FOR SELECT
  USING (rep_id = auth.uid());

-- Reps can create their own sessions
CREATE POLICY "Users can create own sessions"
  ON public.rep_sessions FOR INSERT
  WITH CHECK (rep_id = auth.uid());

-- Reps can update their own sessions
CREATE POLICY "Users can update own sessions"
  ON public.rep_sessions FOR UPDATE
  USING (rep_id = auth.uid());

-- Managers can view team sessions (via company_id)
CREATE POLICY "Managers view team sessions"
  ON public.rep_sessions FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'admin')
    )
  );

-- Enable RLS on rep_session_events
ALTER TABLE public.rep_session_events ENABLE ROW LEVEL SECURITY;

-- Reps can view their own events
CREATE POLICY "Users can view own session events"
  ON public.rep_session_events FOR SELECT
  USING (rep_id = auth.uid());

-- Reps can create their own events
CREATE POLICY "Users can create own session events"
  ON public.rep_session_events FOR INSERT
  WITH CHECK (rep_id = auth.uid());

-- Managers can view team events
CREATE POLICY "Managers view team session events"
  ON public.rep_session_events FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'admin')
    )
  );

-- Enable RLS on company_settings (if not already enabled)
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Users can view their company settings
DROP POLICY IF EXISTS "Users can view company settings" ON public.company_settings;
CREATE POLICY "Users can view company settings"
  ON public.company_settings FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid()
    )
  );

-- Managers can update company settings
DROP POLICY IF EXISTS "Managers can update company settings" ON public.company_settings;
CREATE POLICY "Managers can update company settings"
  ON public.company_settings FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'admin')
    )
  );

-- Managers can insert company settings
DROP POLICY IF EXISTS "Managers can insert company settings" ON public.company_settings;
CREATE POLICY "Managers can insert company settings"
  ON public.company_settings FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'admin')
    )
  );

-- =====================================================
-- 6. HELPER FUNCTIONS
-- =====================================================

-- Function to get or create today's active session for a rep
CREATE OR REPLACE FUNCTION get_or_create_active_session(p_rep_id UUID, p_company_id UUID)
RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
BEGIN
  -- Try to find an existing active session from today
  SELECT id INTO v_session_id
  FROM public.rep_sessions
  WHERE rep_id = p_rep_id
    AND status = 'active'
    AND DATE(started_at AT TIME ZONE 'UTC') = CURRENT_DATE
  LIMIT 1;

  -- If no active session exists, create one
  IF v_session_id IS NULL THEN
    INSERT INTO public.rep_sessions (rep_id, company_id, status)
    VALUES (p_rep_id, p_company_id, 'active')
    RETURNING id INTO v_session_id;
  END IF;

  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to end a session
CREATE OR REPLACE FUNCTION end_rep_session(p_session_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.rep_sessions
  SET
    status = 'completed',
    ended_at = NOW(),
    updated_at = NOW()
  WHERE id = p_session_id
    AND rep_id = auth.uid()
    AND status IN ('active', 'paused');

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_or_create_active_session(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION end_rep_session(UUID) TO authenticated;

-- =====================================================
-- 7. NEWS FEED TABLE
-- For storing news items including daily rep stats
-- =====================================================
CREATE TABLE IF NOT EXISTS public.news_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,  -- null for company-wide

  -- Content
  type TEXT NOT NULL CHECK (type IN (
    'daily_rep_stats', 'weekly_summary', 'achievement', 'announcement',
    'call_highlight', 'booking_milestone', 'team_update'
  )),
  title TEXT NOT NULL,
  content JSONB DEFAULT '{}',

  -- Display
  icon TEXT,
  priority INTEGER DEFAULT 0,  -- Higher = more important
  is_read BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ  -- Optional expiration for temporary items
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_news_feed_company_id ON public.news_feed(company_id);
CREATE INDEX IF NOT EXISTS idx_news_feed_user_id ON public.news_feed(user_id);
CREATE INDEX IF NOT EXISTS idx_news_feed_type ON public.news_feed(type);
CREATE INDEX IF NOT EXISTS idx_news_feed_created_at ON public.news_feed(created_at DESC);

-- Enable RLS
ALTER TABLE public.news_feed ENABLE ROW LEVEL SECURITY;

-- Users can view news feed items for their company or themselves
CREATE POLICY "Users view own company news"
  ON public.news_feed FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- Users can insert news items for their company
CREATE POLICY "Users insert own company news"
  ON public.news_feed FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid()
    )
  );

-- Users can update their own read status
CREATE POLICY "Users update own news read status"
  ON public.news_feed FOR UPDATE
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- =====================================================
-- 8. DAILY REPORT GENERATION FUNCTION
-- =====================================================

-- Function to generate daily stats report for a rep
CREATE OR REPLACE FUNCTION generate_daily_rep_stats(
  p_rep_id UUID,
  p_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day'
)
RETURNS UUID AS $$
DECLARE
  v_company_id UUID;
  v_rep_name TEXT;
  v_total_calls INTEGER;
  v_connected_calls INTEGER;
  v_booked_calls INTEGER;
  v_talk_time_seconds INTEGER;
  v_total_duration_seconds INTEGER;
  v_calls_per_hour NUMERIC;
  v_productivity_score INTEGER;
  v_news_id UUID;
BEGIN
  -- Get company_id and rep name
  SELECT cm.company_id, COALESCE(p.full_name, p.email)
  INTO v_company_id, v_rep_name
  FROM public.company_members cm
  JOIN public.profiles p ON p.id = cm.user_id
  WHERE cm.user_id = p_rep_id
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Aggregate daily stats
  SELECT
    COALESCE(SUM(total_calls), 0),
    COALESCE(SUM(connected_calls), 0),
    COALESCE(SUM(booked_calls), 0),
    COALESCE(SUM(talk_time_seconds), 0),
    COALESCE(SUM(total_duration_seconds), 0)
  INTO v_total_calls, v_connected_calls, v_booked_calls, v_talk_time_seconds, v_total_duration_seconds
  FROM public.rep_sessions
  WHERE rep_id = p_rep_id
    AND DATE(started_at AT TIME ZONE 'UTC') = p_date;

  -- If no activity, don't create a report
  IF v_total_calls = 0 AND v_total_duration_seconds = 0 THEN
    RETURN NULL;
  END IF;

  -- Calculate calls per hour
  IF v_total_duration_seconds > 0 THEN
    v_calls_per_hour := ROUND((v_total_calls::NUMERIC / (v_total_duration_seconds::NUMERIC / 3600)), 1);
  ELSE
    v_calls_per_hour := 0;
  END IF;

  -- Calculate productivity score (% of time on calls)
  IF v_total_duration_seconds > 0 THEN
    v_productivity_score := ROUND((v_talk_time_seconds::NUMERIC / v_total_duration_seconds::NUMERIC) * 100);
  ELSE
    v_productivity_score := 0;
  END IF;

  -- Insert into news feed
  INSERT INTO public.news_feed (
    company_id,
    user_id,
    type,
    title,
    content,
    icon
  ) VALUES (
    v_company_id,
    p_rep_id,
    'daily_rep_stats',
    v_rep_name || '''s Daily Stats',
    jsonb_build_object(
      'date', p_date,
      'rep_id', p_rep_id,
      'rep_name', v_rep_name,
      'total_calls', v_total_calls,
      'connected_calls', v_connected_calls,
      'booked_calls', v_booked_calls,
      'talk_time_minutes', ROUND(v_talk_time_seconds / 60.0),
      'total_duration_minutes', ROUND(v_total_duration_seconds / 60.0),
      'calls_per_hour', v_calls_per_hour,
      'productivity_score', v_productivity_score
    ),
    '📊'
  )
  RETURNING id INTO v_news_id;

  RETURN v_news_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate daily reports for all reps in a company
CREATE OR REPLACE FUNCTION generate_company_daily_reports(
  p_company_id UUID,
  p_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day'
)
RETURNS INTEGER AS $$
DECLARE
  v_rep_id UUID;
  v_count INTEGER := 0;
BEGIN
  FOR v_rep_id IN
    SELECT DISTINCT user_id
    FROM public.company_members
    WHERE company_id = p_company_id
  LOOP
    IF generate_daily_rep_stats(v_rep_id, p_date) IS NOT NULL THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_daily_rep_stats(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_company_daily_reports(UUID, DATE) TO authenticated;

-- Comments for documentation
COMMENT ON TABLE public.rep_sessions IS 'Tracks working sessions for sales reps, including call metrics and time tracking';
COMMENT ON TABLE public.rep_session_events IS 'Granular event log for detailed session analysis';
COMMENT ON TABLE public.news_feed IS 'News feed items for company and user-specific notifications';
COMMENT ON VIEW public.rep_daily_stats IS 'Aggregated daily statistics for rep productivity reporting';
COMMENT ON COLUMN public.company_settings.break_detection_enabled IS 'When true, shows break warnings after idle timeout';
COMMENT ON COLUMN public.company_settings.break_detection_minutes IS 'Minutes of idle time before showing break warning';
COMMENT ON COLUMN public.company_settings.daily_report_time IS 'Time of day to generate daily reports (HH:MM format)';
COMMENT ON FUNCTION generate_daily_rep_stats IS 'Generates a daily stats report for a rep and posts to news feed';
COMMENT ON FUNCTION generate_company_daily_reports IS 'Generates daily reports for all reps in a company';
