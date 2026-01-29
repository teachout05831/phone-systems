-- Migration: Coaching Assistant Chat & Tickets
-- Stores all interactions with the AI coaching assistant and improvement tickets

-- ============================================
-- CHAT SESSIONS TABLE
-- Groups messages into conversations
-- ============================================
CREATE TABLE IF NOT EXISTS coaching_assistant_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Session identification
  session_token TEXT UNIQUE NOT NULL, -- Browser session identifier
  user_identifier TEXT, -- Optional user ID or name

  -- Context at session start
  knowledge_base_id UUID REFERENCES knowledge_bases(id),
  knowledge_base_name TEXT,

  -- Session stats
  message_count INTEGER DEFAULT 0,
  tickets_created INTEGER DEFAULT 0,

  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- CHAT MESSAGES TABLE
-- Individual messages in conversations
-- ============================================
CREATE TABLE IF NOT EXISTS coaching_assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to session
  session_id UUID NOT NULL REFERENCES coaching_assistant_sessions(id) ON DELETE CASCADE,

  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,

  -- Context snapshot at time of message
  context_snapshot JSONB DEFAULT '{}',
  -- Example: { phase: 'pricing', lastScript: {...}, conversationLength: 4 }

  -- For assistant messages - what was the query about?
  query_type TEXT, -- 'why_triggered', 'phase_question', 'improvement', 'general'

  -- If this message led to a ticket
  ticket_id UUID,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- IMPROVEMENT TICKETS TABLE
-- Tickets created from chat conversations
-- ============================================
CREATE TABLE IF NOT EXISTS coaching_improvement_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ticket number (auto-increment for display)
  ticket_number SERIAL,

  -- Link to source conversation
  session_id UUID REFERENCES coaching_assistant_sessions(id),
  source_message_id UUID REFERENCES coaching_assistant_messages(id),

  -- Ticket details
  title TEXT NOT NULL,
  description TEXT,
  suggested_fix TEXT,

  -- Categorization
  category TEXT NOT NULL CHECK (category IN (
    'missing_trigger',
    'script_improvement',
    'phase_detection',
    'new_script_request',
    'bug_report',
    'feature_request',
    'other'
  )),

  -- What it affects
  affected_knowledge_base_id UUID REFERENCES knowledge_bases(id),
  affected_script_id UUID REFERENCES scripts(id),
  affected_category_id UUID REFERENCES objection_categories(id),

  -- Priority (can be AI-suggested or manually set)
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),

  -- Status tracking
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'wont_fix', 'duplicate')),

  -- Full context snapshot
  context_snapshot JSONB DEFAULT '{}',
  -- Includes: conversation history, current phase, scripts shown, etc.

  -- Resolution
  resolution_notes TEXT,
  resolved_by TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_chat_sessions_token ON coaching_assistant_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_kb ON coaching_assistant_sessions(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_activity ON coaching_assistant_sessions(last_activity_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON coaching_assistant_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON coaching_assistant_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_type ON coaching_assistant_messages(query_type);

CREATE INDEX IF NOT EXISTS idx_tickets_status ON coaching_improvement_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_category ON coaching_improvement_tickets(category);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON coaching_improvement_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_created ON coaching_improvement_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_kb ON coaching_improvement_tickets(affected_knowledge_base_id);

-- ============================================
-- TRIGGER: Update session stats
-- ============================================
CREATE OR REPLACE FUNCTION update_session_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE coaching_assistant_sessions
    SET
      message_count = message_count + 1,
      last_activity_at = NOW()
    WHERE id = NEW.session_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_session_stats ON coaching_assistant_messages;
CREATE TRIGGER trigger_update_session_stats
  AFTER INSERT ON coaching_assistant_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_session_stats();

-- ============================================
-- TRIGGER: Update ticket count on session
-- ============================================
CREATE OR REPLACE FUNCTION update_session_ticket_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.session_id IS NOT NULL THEN
    UPDATE coaching_assistant_sessions
    SET tickets_created = tickets_created + 1
    WHERE id = NEW.session_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ticket_count ON coaching_improvement_tickets;
CREATE TRIGGER trigger_update_ticket_count
  AFTER INSERT ON coaching_improvement_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_session_ticket_count();

-- ============================================
-- VIEW: Recent chat activity (for admin)
-- ============================================
CREATE OR REPLACE VIEW coaching_chat_activity AS
SELECT
  s.id as session_id,
  s.session_token,
  s.user_identifier,
  s.knowledge_base_name,
  s.message_count,
  s.tickets_created,
  s.started_at,
  s.last_activity_at,
  (
    SELECT json_agg(json_build_object(
      'role', m.role,
      'content', m.content,
      'created_at', m.created_at
    ) ORDER BY m.created_at)
    FROM coaching_assistant_messages m
    WHERE m.session_id = s.id
  ) as messages
FROM coaching_assistant_sessions s
ORDER BY s.last_activity_at DESC;

-- ============================================
-- VIEW: Ticket overview (for admin)
-- ============================================
CREATE OR REPLACE VIEW coaching_tickets_overview AS
SELECT
  t.id,
  t.ticket_number,
  t.title,
  t.category,
  t.priority,
  t.status,
  t.created_at,
  t.updated_at,
  kb.name as knowledge_base_name,
  s.title as script_name,
  sess.user_identifier,
  sess.session_token
FROM coaching_improvement_tickets t
LEFT JOIN knowledge_bases kb ON t.affected_knowledge_base_id = kb.id
LEFT JOIN scripts s ON t.affected_script_id = s.id
LEFT JOIN coaching_assistant_sessions sess ON t.session_id = sess.id
ORDER BY
  CASE t.priority
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  t.created_at DESC;
