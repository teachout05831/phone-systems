-- Conversation Flows & Objection Categories for Systematic AI Coaching
-- This enables multi-step conversation flows with branching based on customer responses

-- ============ OBJECTION CATEGORIES ============
-- Categories help identify the type of objection for better script matching

CREATE TABLE IF NOT EXISTS objection_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- 'price', 'timing', 'authority' (internal key)
  display_name TEXT NOT NULL,            -- 'Price Objection' (shown in UI)
  icon TEXT,                             -- Emoji icon for visual identification
  color TEXT,                            -- Hex color for UI styling
  detection_keywords TEXT[] NOT NULL,    -- Keywords that identify this category
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============ CONVERSATION FLOWS ============
-- Flows define multi-step conversation sequences

CREATE TABLE IF NOT EXISTS conversation_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- 'Price Objection Flow'
  description TEXT,                       -- Optional description
  entry_category_id UUID REFERENCES objection_categories(id) ON DELETE SET NULL,
  entry_triggers TEXT[],                 -- Additional trigger phrases to start this flow
  is_active BOOLEAN DEFAULT TRUE,
  times_started INT DEFAULT 0,           -- How many times flow was started
  times_completed INT DEFAULT 0,         -- How many times flow reached end
  avg_steps_completed DECIMAL(5,2),      -- Average steps completed before exit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============ FLOW NODES ============
-- Individual steps within a conversation flow

CREATE TABLE IF NOT EXISTS flow_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID REFERENCES conversation_flows(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL CHECK (node_type IN ('entry', 'response', 'question', 'close', 'branch', 'exit')),
  step_number INT NOT NULL,              -- 1, 2, 3, etc. (for progress display)
  title TEXT NOT NULL,                   -- 'Acknowledge + Value Question'
  script_text TEXT NOT NULL,             -- What the rep should say
  story_text TEXT,                       -- Optional story component
  tips TEXT,                             -- Delivery tips
  expected_responses TEXT[],             -- What customer might say (shown to rep as "Listen for")
  is_optional BOOLEAN DEFAULT FALSE,     -- Can this step be skipped?
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============ FLOW BRANCHES ============
-- Define how nodes connect based on customer response

CREATE TABLE IF NOT EXISTS flow_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node_id UUID REFERENCES flow_nodes(id) ON DELETE CASCADE,
  to_node_id UUID REFERENCES flow_nodes(id) ON DELETE CASCADE,
  trigger_keywords TEXT[],               -- Keywords in customer response that trigger this branch
  label TEXT,                            -- 'Customer agrees', 'Customer is unsure' (for UI)
  is_default BOOLEAN DEFAULT FALSE,      -- Use this branch if no keywords match
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============ ALTER SCRIPTS TABLE ============
-- Add objection category reference and flow support to existing scripts

ALTER TABLE scripts
ADD COLUMN IF NOT EXISTS objection_category_id UUID REFERENCES objection_categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS parent_script_id UUID REFERENCES scripts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS suggested_follow_ups UUID[],
ADD COLUMN IF NOT EXISTS match_score_weight INT DEFAULT 10;  -- Higher = preferred when scores are equal

-- ============ FLOW PROGRESS TRACKING ============
-- Track rep's progress through a flow during a call

CREATE TABLE IF NOT EXISTS call_flow_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid TEXT NOT NULL,
  flow_id UUID REFERENCES conversation_flows(id) ON DELETE SET NULL,
  knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE SET NULL,
  current_node_id UUID REFERENCES flow_nodes(id) ON DELETE SET NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  steps_shown INT DEFAULT 0,
  steps_used INT DEFAULT 0,
  exit_reason TEXT,                      -- 'completed', 'abandoned', 'branched_out'
  rep_id UUID REFERENCES auth.users(id)
);

-- ============ INDEXES ============

CREATE INDEX IF NOT EXISTS idx_objection_categories_kb ON objection_categories(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_objection_categories_keywords ON objection_categories USING GIN(detection_keywords);
CREATE INDEX IF NOT EXISTS idx_conversation_flows_kb ON conversation_flows(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_conversation_flows_category ON conversation_flows(entry_category_id);
CREATE INDEX IF NOT EXISTS idx_flow_nodes_flow ON flow_nodes(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_branches_from ON flow_branches(from_node_id);
CREATE INDEX IF NOT EXISTS idx_flow_branches_to ON flow_branches(to_node_id);
CREATE INDEX IF NOT EXISTS idx_call_flow_progress_call ON call_flow_progress(call_sid);
CREATE INDEX IF NOT EXISTS idx_scripts_category ON scripts(objection_category_id);

-- ============ SEED DEFAULT OBJECTION CATEGORIES ============
-- These are universal categories applicable to any knowledge base

INSERT INTO objection_categories (knowledge_base_id, name, display_name, icon, color, detection_keywords, sort_order)
SELECT
  kb.id,
  'price',
  'Price Objection',
  '💰',
  '#f59e0b',
  ARRAY['expensive', 'cost', 'afford', 'budget', 'too much', 'cheaper', 'price', 'money', 'can''t pay', 'out of my range', 'not in the budget'],
  1
FROM knowledge_bases kb WHERE kb.name = 'General Sales';

INSERT INTO objection_categories (knowledge_base_id, name, display_name, icon, color, detection_keywords, sort_order)
SELECT
  kb.id,
  'timing',
  'Timing Objection',
  '⏰',
  '#3b82f6',
  ARRAY['not now', 'bad time', 'later', 'think about it', 'busy', 'not ready', 'next month', 'next year', 'maybe later', 'give me time', 'call back'],
  2
FROM knowledge_bases kb WHERE kb.name = 'General Sales';

INSERT INTO objection_categories (knowledge_base_id, name, display_name, icon, color, detection_keywords, sort_order)
SELECT
  kb.id,
  'authority',
  'Authority Objection',
  '👥',
  '#8b5cf6',
  ARRAY['spouse', 'partner', 'husband', 'wife', 'boss', 'discuss', 'decision maker', 'talk to', 'check with', 'not my decision', 'need approval'],
  3
FROM knowledge_bases kb WHERE kb.name = 'General Sales';

INSERT INTO objection_categories (knowledge_base_id, name, display_name, icon, color, detection_keywords, sort_order)
SELECT
  kb.id,
  'trust',
  'Trust/Skepticism',
  '🤔',
  '#ec4899',
  ARRAY['not sure', 'guarantee', 'reviews', 'prove', 'skeptical', 'too good', 'scam', 'how do I know', 'references', 'sounds fake'],
  4
FROM knowledge_bases kb WHERE kb.name = 'General Sales';

INSERT INTO objection_categories (knowledge_base_id, name, display_name, icon, color, detection_keywords, sort_order)
SELECT
  kb.id,
  'competitor',
  'Competitor Objection',
  '🏢',
  '#14b8a6',
  ARRAY['already have', 'use someone else', 'current provider', 'happy with', 'loyal to', 'under contract', 'existing service', 'another company'],
  5
FROM knowledge_bases kb WHERE kb.name = 'General Sales';

INSERT INTO objection_categories (knowledge_base_id, name, display_name, icon, color, detection_keywords, sort_order)
SELECT
  kb.id,
  'no_need',
  'No Need Objection',
  '❓',
  '#6b7280',
  ARRAY['don''t need', 'not interested', 'do it myself', 'satisfied', 'no need', 'don''t want', 'not for me', 'don''t see the point'],
  6
FROM knowledge_bases kb WHERE kb.name = 'General Sales';

-- ============ SAMPLE CONVERSATION FLOW ============
-- Price Objection Flow for General Sales

DO $$
DECLARE
  v_kb_id UUID;
  v_category_id UUID;
  v_flow_id UUID;
  v_node1_id UUID;
  v_node2a_id UUID;
  v_node2b_id UUID;
  v_node3_id UUID;
  v_node4_id UUID;
BEGIN
  -- Get General Sales KB
  SELECT id INTO v_kb_id FROM knowledge_bases WHERE name = 'General Sales' LIMIT 1;

  -- Get Price category
  SELECT id INTO v_category_id FROM objection_categories WHERE name = 'price' AND knowledge_base_id = v_kb_id LIMIT 1;

  IF v_kb_id IS NOT NULL AND v_category_id IS NOT NULL THEN
    -- Create the flow
    INSERT INTO conversation_flows (knowledge_base_id, name, description, entry_category_id, entry_triggers)
    VALUES (
      v_kb_id,
      'Price Objection Flow',
      'A 4-step flow to handle price objections by uncovering value and offering solutions',
      v_category_id,
      ARRAY['too expensive', 'costs too much', 'can''t afford']
    ) RETURNING id INTO v_flow_id;

    -- Node 1: Entry - Acknowledge + Value Question
    INSERT INTO flow_nodes (flow_id, node_type, step_number, title, script_text, tips, expected_responses, sort_order)
    VALUES (
      v_flow_id,
      'entry',
      1,
      'Acknowledge + Value Question',
      'I completely understand. Budget is always an important consideration. Let me ask you this - if price wasn''t a factor, would this solution solve the problem you''re facing?',
      'Pause after asking to give them time to reflect. This question helps uncover if price is the real objection or just a smokescreen.',
      ARRAY['Yes, but...', 'I guess so', 'No, not really', 'Maybe'],
      1
    ) RETURNING id INTO v_node1_id;

    -- Node 2A: Value Justification (if they agree)
    INSERT INTO flow_nodes (flow_id, node_type, step_number, title, script_text, tips, expected_responses, sort_order)
    VALUES (
      v_flow_id,
      'response',
      2,
      'Value Justification',
      'Perfect. So you see the value in what we offer. Let me share how our customers typically see a return on this investment within the first few months. Most tell us it actually saves them money in the long run because of [specific benefit]. Would it help if I showed you the payment options we have available?',
      'Connect the investment to ROI. Use specific numbers if available.',
      ARRAY['Yes, show me options', 'What options?', 'Still too much', 'Let me think'],
      2
    ) RETURNING id INTO v_node2a_id;

    -- Node 2B: Needs Discovery (if uncertain)
    INSERT INTO flow_nodes (flow_id, node_type, step_number, title, script_text, tips, expected_responses, sort_order)
    VALUES (
      v_flow_id,
      'question',
      2,
      'Deeper Needs Discovery',
      'I hear some hesitation. Help me understand - is it that you''re not sure this will solve your problem, or is it specifically about the investment amount?',
      'This isolates whether it''s a value problem or a budget problem. Handle each differently.',
      ARRAY['Not sure it will work', 'It''s the money', 'Both really'],
      3
    ) RETURNING id INTO v_node2b_id;

    -- Node 3: Payment Options
    INSERT INTO flow_nodes (flow_id, node_type, step_number, title, script_text, tips, expected_responses, sort_order)
    VALUES (
      v_flow_id,
      'response',
      3,
      'Present Payment Options',
      'We have a few ways to make this work for your budget. Our most popular option is [payment plan], which breaks it down to just [amount] per [period]. That''s less than what most people spend on [relatable comparison]. Which option works best for you?',
      'Always give 2-3 options. Never just one. Let them feel in control of the choice.',
      ARRAY['Option 1', 'Option 2', 'Still need to think', 'Not right now'],
      4
    ) RETURNING id INTO v_node3_id;

    -- Node 4: Close
    INSERT INTO flow_nodes (flow_id, node_type, step_number, title, script_text, tips, expected_responses, sort_order)
    VALUES (
      v_flow_id,
      'close',
      4,
      'Close Attempt',
      'Based on what you''ve shared, the [recommended option] would work best for you. Should we get you started with that today?',
      'Be assumptive. Use "when" language, not "if" language.',
      ARRAY['Yes, let''s do it', 'Not today', 'I need to think'],
      5
    ) RETURNING id INTO v_node4_id;

    -- Create branches
    -- From Node 1 to 2A (if customer agrees)
    INSERT INTO flow_branches (from_node_id, to_node_id, trigger_keywords, label, is_default, sort_order)
    VALUES (v_node1_id, v_node2a_id, ARRAY['yes', 'yeah', 'sure', 'would', 'definitely', 'of course'], 'Customer agrees it would help', FALSE, 1);

    -- From Node 1 to 2B (if customer is uncertain)
    INSERT INTO flow_branches (from_node_id, to_node_id, trigger_keywords, label, is_default, sort_order)
    VALUES (v_node1_id, v_node2b_id, ARRAY['guess', 'maybe', 'not sure', 'I don''t know', 'possibly'], 'Customer is uncertain', FALSE, 2);

    -- From Node 1 to 2B (default fallback)
    INSERT INTO flow_branches (from_node_id, to_node_id, trigger_keywords, label, is_default, sort_order)
    VALUES (v_node1_id, v_node2b_id, ARRAY[]::TEXT[], 'Default path', TRUE, 3);

    -- From Node 2A to 3
    INSERT INTO flow_branches (from_node_id, to_node_id, trigger_keywords, label, is_default, sort_order)
    VALUES (v_node2a_id, v_node3_id, ARRAY[]::TEXT[], 'Continue to options', TRUE, 1);

    -- From Node 2B to 3
    INSERT INTO flow_branches (from_node_id, to_node_id, trigger_keywords, label, is_default, sort_order)
    VALUES (v_node2b_id, v_node3_id, ARRAY['money', 'budget', 'afford', 'investment'], 'Budget concern', TRUE, 1);

    -- From Node 3 to 4
    INSERT INTO flow_branches (from_node_id, to_node_id, trigger_keywords, label, is_default, sort_order)
    VALUES (v_node3_id, v_node4_id, ARRAY[]::TEXT[], 'Move to close', TRUE, 1);

    RAISE NOTICE 'Created Price Objection Flow with % nodes', 5;
  END IF;
END $$;

-- ============ RLS POLICIES ============

ALTER TABLE objection_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_flow_progress ENABLE ROW LEVEL SECURITY;

-- Read access for active items
CREATE POLICY "Anyone can view active objection categories" ON objection_categories
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Anyone can view active conversation flows" ON conversation_flows
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Anyone can view flow nodes" ON flow_nodes
  FOR SELECT USING (TRUE);

CREATE POLICY "Anyone can view flow branches" ON flow_branches
  FOR SELECT USING (TRUE);

-- Authenticated users can track flow progress
CREATE POLICY "Authenticated users can track flow progress" ON call_flow_progress
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own flow progress" ON call_flow_progress
  FOR UPDATE USING (rep_id = auth.uid() OR rep_id IS NULL);

CREATE POLICY "Anyone can view flow progress" ON call_flow_progress
  FOR SELECT USING (TRUE);

-- ============ HELPER FUNCTIONS ============

-- Function to detect objection category from text
CREATE OR REPLACE FUNCTION detect_objection_category(
  p_text TEXT,
  p_knowledge_base_id UUID DEFAULT NULL
)
RETURNS TABLE (
  category_id UUID,
  category_name TEXT,
  display_name TEXT,
  icon TEXT,
  color TEXT,
  match_score INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    oc.id as category_id,
    oc.name as category_name,
    oc.display_name,
    oc.icon,
    oc.color,
    (
      SELECT COUNT(*)::INT
      FROM unnest(oc.detection_keywords) kw
      WHERE LOWER(p_text) LIKE '%' || LOWER(kw) || '%'
    ) as match_score
  FROM objection_categories oc
  WHERE oc.is_active = TRUE
    AND (p_knowledge_base_id IS NULL OR oc.knowledge_base_id = p_knowledge_base_id)
  ORDER BY match_score DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql;

-- Function to get flow for a category
CREATE OR REPLACE FUNCTION get_flow_for_category(
  p_category_id UUID
)
RETURNS TABLE (
  flow_id UUID,
  flow_name TEXT,
  first_node_id UUID,
  first_node_script TEXT,
  first_node_tips TEXT,
  expected_responses TEXT[],
  total_steps INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cf.id as flow_id,
    cf.name as flow_name,
    fn.id as first_node_id,
    fn.script_text as first_node_script,
    fn.tips as first_node_tips,
    fn.expected_responses,
    (SELECT COUNT(*)::INT FROM flow_nodes WHERE flow_id = cf.id) as total_steps
  FROM conversation_flows cf
  JOIN flow_nodes fn ON fn.flow_id = cf.id AND fn.node_type = 'entry'
  WHERE cf.entry_category_id = p_category_id
    AND cf.is_active = TRUE
  ORDER BY cf.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to get next node in flow based on customer response
CREATE OR REPLACE FUNCTION get_next_flow_node(
  p_current_node_id UUID,
  p_customer_text TEXT DEFAULT NULL
)
RETURNS TABLE (
  next_node_id UUID,
  node_type TEXT,
  step_number INT,
  title TEXT,
  script_text TEXT,
  tips TEXT,
  expected_responses TEXT[],
  branch_label TEXT
) AS $$
DECLARE
  v_branch RECORD;
  v_max_score INT := 0;
  v_best_branch_id UUID;
BEGIN
  -- Find the best matching branch
  FOR v_branch IN
    SELECT fb.id, fb.to_node_id, fb.trigger_keywords, fb.is_default, fb.label
    FROM flow_branches fb
    WHERE fb.from_node_id = p_current_node_id
    ORDER BY fb.is_default ASC, fb.sort_order ASC
  LOOP
    IF p_customer_text IS NOT NULL AND array_length(v_branch.trigger_keywords, 1) > 0 THEN
      -- Calculate match score
      DECLARE
        v_score INT := 0;
        v_kw TEXT;
      BEGIN
        FOREACH v_kw IN ARRAY v_branch.trigger_keywords LOOP
          IF LOWER(p_customer_text) LIKE '%' || LOWER(v_kw) || '%' THEN
            v_score := v_score + 1;
          END IF;
        END LOOP;

        IF v_score > v_max_score THEN
          v_max_score := v_score;
          v_best_branch_id := v_branch.id;
        END IF;
      END;
    ELSIF v_branch.is_default AND v_best_branch_id IS NULL THEN
      v_best_branch_id := v_branch.id;
    END IF;
  END LOOP;

  -- Return the next node
  RETURN QUERY
  SELECT
    fn.id as next_node_id,
    fn.node_type,
    fn.step_number,
    fn.title,
    fn.script_text,
    fn.tips,
    fn.expected_responses,
    fb.label as branch_label
  FROM flow_branches fb
  JOIN flow_nodes fn ON fn.id = fb.to_node_id
  WHERE fb.id = v_best_branch_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION detect_objection_category(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION detect_objection_category(TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_flow_for_category(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_flow_for_category(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_next_flow_node(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_flow_node(UUID, TEXT) TO anon;

-- Comment for documentation
COMMENT ON TABLE objection_categories IS 'Categories of sales objections (price, timing, authority, etc.) with detection keywords';
COMMENT ON TABLE conversation_flows IS 'Multi-step conversation sequences for handling specific objection types';
COMMENT ON TABLE flow_nodes IS 'Individual steps within a conversation flow';
COMMENT ON TABLE flow_branches IS 'Connections between flow nodes with conditional branching';
COMMENT ON TABLE call_flow_progress IS 'Tracks which flow/node a rep is on during a call';
