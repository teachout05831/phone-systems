-- Call Phases and Context Tracking for AI Coaching
-- Enables phase-aware script suggestions and background conversation context

-- ============ SCRIPTS TABLE MODIFICATIONS ============
-- Add phase-specific columns to scripts table

-- Which phases this script is applicable to
ALTER TABLE scripts
ADD COLUMN IF NOT EXISTS applicable_phases TEXT[] DEFAULT ARRAY['intro','discovery','presentation','pricing','objection_handling','closing'];

-- Phase-specific guidance for showing different tips per phase
ALTER TABLE scripts
ADD COLUMN IF NOT EXISTS phase_specific_guidance JSONB DEFAULT '{}';

-- Index for phase filtering
CREATE INDEX IF NOT EXISTS idx_scripts_applicable_phases
ON scripts USING GIN(applicable_phases);

COMMENT ON COLUMN scripts.applicable_phases IS 'Call phases where this script should be shown: intro, discovery, presentation, pricing, objection_handling, closing';
COMMENT ON COLUMN scripts.phase_specific_guidance IS 'JSON with phase-specific tips, e.g. {"pricing": "Focus on ROI", "closing": "Be more direct"}';

-- ============ CALL SCRIPT USAGE MODIFICATIONS ============
-- Track which phase the script was shown in

ALTER TABLE call_script_usage
ADD COLUMN IF NOT EXISTS call_phase TEXT;

ALTER TABLE call_script_usage
ADD COLUMN IF NOT EXISTS context_summary_used BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_call_script_usage_phase
ON call_script_usage(call_phase);

COMMENT ON COLUMN call_script_usage.call_phase IS 'The detected call phase when this script was shown';
COMMENT ON COLUMN call_script_usage.context_summary_used IS 'Whether context summary was available for AI selection';

-- ============ CALL PHASE ANALYTICS TABLE ============
-- Track phase transitions and analytics per call

CREATE TABLE IF NOT EXISTS call_phase_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid TEXT NOT NULL,
  phase TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  detected_by TEXT DEFAULT 'keyword',
  confidence_score DECIMAL(4,3),
  phase_outcome TEXT,
  scripts_shown_count INTEGER DEFAULT 0,
  scripts_used_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_phase_analytics_call_sid
ON call_phase_analytics(call_sid);

CREATE INDEX IF NOT EXISTS idx_call_phase_analytics_phase
ON call_phase_analytics(phase);

CREATE INDEX IF NOT EXISTS idx_call_phase_analytics_started_at
ON call_phase_analytics(started_at);

COMMENT ON TABLE call_phase_analytics IS 'Tracks call phase transitions for analytics and coaching insights';
COMMENT ON COLUMN call_phase_analytics.phase IS 'Call phase: intro, discovery, presentation, pricing, objection_handling, closing';
COMMENT ON COLUMN call_phase_analytics.detected_by IS 'How phase was detected: keyword or ai';
COMMENT ON COLUMN call_phase_analytics.phase_outcome IS 'Outcome when leaving phase: success, objection, stall, exit';

-- ============ CALL CONTEXT SNAPSHOTS TABLE ============
-- Store periodic context summaries for analytics and debugging

CREATE TABLE IF NOT EXISTS call_context_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid TEXT NOT NULL,
  summary TEXT,
  topics TEXT[],
  customer_sentiment TEXT,
  key_insights JSONB DEFAULT '{}',
  transcript_entry_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_context_snapshots_call_sid
ON call_context_snapshots(call_sid);

CREATE INDEX IF NOT EXISTS idx_call_context_snapshots_created_at
ON call_context_snapshots(created_at);

COMMENT ON TABLE call_context_snapshots IS 'Periodic snapshots of AI-generated conversation context';
COMMENT ON COLUMN call_context_snapshots.summary IS 'AI-generated summary of conversation so far';
COMMENT ON COLUMN call_context_snapshots.topics IS 'Topics discussed in the conversation';
COMMENT ON COLUMN call_context_snapshots.customer_sentiment IS 'Detected customer sentiment: positive, neutral, negative, mixed';

-- ============ RLS POLICIES ============

ALTER TABLE call_phase_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_context_snapshots ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for server-side operations)
CREATE POLICY "Service role can manage call_phase_analytics"
ON call_phase_analytics
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can manage call_context_snapshots"
ON call_context_snapshots
FOR ALL
USING (true)
WITH CHECK (true);

-- ============ ANALYTICS VIEWS ============

-- View for phase duration statistics
CREATE OR REPLACE VIEW call_phase_stats AS
SELECT
  phase,
  COUNT(*) as total_occurrences,
  AVG(duration_seconds) as avg_duration_seconds,
  MIN(duration_seconds) as min_duration_seconds,
  MAX(duration_seconds) as max_duration_seconds,
  COUNT(CASE WHEN phase_outcome = 'success' THEN 1 END) as success_count,
  COUNT(CASE WHEN phase_outcome = 'objection' THEN 1 END) as objection_count,
  SUM(scripts_shown_count) as total_scripts_shown,
  SUM(scripts_used_count) as total_scripts_used
FROM call_phase_analytics
WHERE duration_seconds IS NOT NULL
GROUP BY phase;

-- View for per-call phase progression
CREATE OR REPLACE VIEW call_phase_progression AS
SELECT
  call_sid,
  array_agg(phase ORDER BY started_at) as phase_sequence,
  COUNT(DISTINCT phase) as phases_visited,
  MIN(started_at) as call_started,
  MAX(COALESCE(ended_at, started_at)) as last_activity
FROM call_phase_analytics
GROUP BY call_sid;

-- ============ RPC FUNCTIONS ============

-- Function to increment scripts_shown_count for a phase
CREATE OR REPLACE FUNCTION increment_phase_scripts_shown(p_call_sid TEXT, p_phase TEXT)
RETURNS void AS $$
BEGIN
  UPDATE call_phase_analytics
  SET scripts_shown_count = COALESCE(scripts_shown_count, 0) + 1
  WHERE call_sid = p_call_sid
    AND phase = p_phase
    AND ended_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment scripts_used_count for a phase
CREATE OR REPLACE FUNCTION increment_phase_scripts_used(p_call_sid TEXT, p_phase TEXT)
RETURNS void AS $$
BEGIN
  UPDATE call_phase_analytics
  SET scripts_used_count = COALESCE(scripts_used_count, 0) + 1
  WHERE call_sid = p_call_sid
    AND phase = p_phase
    AND ended_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
