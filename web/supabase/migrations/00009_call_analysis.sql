-- ============================================
-- CALL ANALYSIS TABLE
-- Stores AI analysis of call transcripts
-- ============================================

CREATE TABLE public.call_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID REFERENCES public.calls(id) ON DELETE CASCADE,
  transcript_id UUID REFERENCES public.call_transcripts(id) ON DELETE CASCADE,

  -- Analysis type (basic mode uses post-call, advanced uses real-time)
  analysis_type TEXT NOT NULL DEFAULT 'post_call' CHECK (analysis_type IN ('post_call', 'real_time')),

  -- AI-generated analysis
  summary TEXT,                    -- Brief call summary
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  sentiment_score DECIMAL(3, 2),   -- -1.0 to 1.0

  -- Key insights (JSONB for flexibility)
  key_points JSONB DEFAULT '[]',   -- [{point: "...", importance: "high|medium|low"}]
  objections_raised JSONB DEFAULT '[]', -- [{objection: "...", handled: true/false}]
  buying_signals JSONB DEFAULT '[]', -- [{signal: "...", confidence: 0.0-1.0}]
  action_items JSONB DEFAULT '[]', -- [{item: "...", assignee: "rep|customer", due: "..."}]

  -- Performance metrics
  talk_ratio JSONB DEFAULT '{}',   -- {rep: 0.4, customer: 0.6}
  questions_asked INTEGER DEFAULT 0,

  -- Outcome prediction
  predicted_outcome TEXT CHECK (predicted_outcome IN ('booked', 'callback', 'interested', 'not_interested', 'uncertain')),
  confidence_score DECIMAL(3, 2), -- 0.0 to 1.0

  -- Coaching suggestions
  coaching_tips JSONB DEFAULT '[]', -- [{tip: "...", category: "rapport|objection|closing|..."}]

  -- Model info
  model_used TEXT DEFAULT 'claude-3-haiku-20240307',
  tokens_used INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_call_analysis_call ON public.call_analysis(call_id);
CREATE INDEX idx_call_analysis_transcript ON public.call_analysis(transcript_id);
CREATE INDEX idx_call_analysis_sentiment ON public.call_analysis(sentiment);
CREATE INDEX idx_call_analysis_created ON public.call_analysis(created_at DESC);

-- Enable RLS
ALTER TABLE public.call_analysis ENABLE ROW LEVEL SECURITY;

-- Users can view analysis for calls in their company
CREATE POLICY "Users can view call analysis"
  ON public.call_analysis FOR SELECT
  USING (
    call_id IN (
      SELECT id FROM public.calls WHERE company_id IN (
        SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
      )
    )
  );

-- Users can manage analysis for calls in their company
CREATE POLICY "Users can manage call analysis"
  ON public.call_analysis FOR ALL
  USING (
    call_id IN (
      SELECT id FROM public.calls WHERE company_id IN (
        SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
      )
    )
  );

-- Note: Service role key automatically bypasses RLS in Supabase
-- No explicit policy needed for server-side operations
