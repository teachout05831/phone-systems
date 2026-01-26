-- Pipeline Stages and Deals Migration
-- Enables full deal-based pipeline management with drag-drop Kanban board

-- Pipeline Stages (per company, customizable order)
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  position INTEGER NOT NULL DEFAULT 0,
  is_closed_won BOOLEAN NOT NULL DEFAULT FALSE,
  is_closed_lost BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, slug)
);

-- Deals (sales opportunities linked to contacts)
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  value DECIMAL(12, 2) DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'warm' CHECK (priority IN ('hot', 'warm', 'cold')),
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'facebook', 'google', 'website', 'referral', 'other')),
  expected_close_date DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Activity Log (tracks all activity across the system)
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('contact', 'deal', 'call', 'sms', 'callback', 'note')),
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'status_changed', 'stage_changed', 'note_added', 'call_made', 'sms_sent', 'callback_scheduled')),
  old_value JSONB,
  new_value JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_company ON pipeline_stages(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_company ON deals(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_contact ON deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_assigned_to ON deals(assigned_to);
CREATE INDEX IF NOT EXISTS idx_activity_log_company ON activity_log(company_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);

-- RLS Policies
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Pipeline Stages Policies
CREATE POLICY "Users can view stages in their company" ON pipeline_stages
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage stages in their company" ON pipeline_stages
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

-- Deals Policies
CREATE POLICY "Users can view deals in their company" ON deals
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage deals in their company" ON deals
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

-- Activity Log Policies
CREATE POLICY "Users can view activity in their company" ON activity_log
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create activity in their company" ON activity_log
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

-- Function to seed default pipeline stages for a new company
CREATE OR REPLACE FUNCTION create_default_pipeline_stages()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO pipeline_stages (company_id, name, slug, color, position, is_closed_won, is_closed_lost) VALUES
    (NEW.id, 'New Lead', 'new', '#3b82f6', 0, FALSE, FALSE),
    (NEW.id, 'Contacted', 'contacted', '#8b5cf6', 1, FALSE, FALSE),
    (NEW.id, 'Qualified', 'qualified', '#f59e0b', 2, FALSE, FALSE),
    (NEW.id, 'Proposal', 'proposal', '#06b6d4', 3, FALSE, FALSE),
    (NEW.id, 'Negotiation', 'negotiation', '#f97316', 4, FALSE, FALSE),
    (NEW.id, 'Won', 'won', '#22c55e', 5, TRUE, FALSE),
    (NEW.id, 'Lost', 'lost', '#ef4444', 6, FALSE, TRUE);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create default stages when a company is created
DROP TRIGGER IF EXISTS create_default_stages_trigger ON companies;
CREATE TRIGGER create_default_stages_trigger
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION create_default_pipeline_stages();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_pipeline_stages_updated_at ON pipeline_stages;
CREATE TRIGGER update_pipeline_stages_updated_at
  BEFORE UPDATE ON pipeline_stages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_deals_updated_at ON deals;
CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default stages for existing companies (if they don't have any)
INSERT INTO pipeline_stages (company_id, name, slug, color, position, is_closed_won, is_closed_lost)
SELECT c.id, stage.name, stage.slug, stage.color, stage.position, stage.is_closed_won, stage.is_closed_lost
FROM companies c
CROSS JOIN (
  VALUES
    ('New Lead', 'new', '#3b82f6', 0, FALSE, FALSE),
    ('Contacted', 'contacted', '#8b5cf6', 1, FALSE, FALSE),
    ('Qualified', 'qualified', '#f59e0b', 2, FALSE, FALSE),
    ('Proposal', 'proposal', '#06b6d4', 3, FALSE, FALSE),
    ('Negotiation', 'negotiation', '#f97316', 4, FALSE, FALSE),
    ('Won', 'won', '#22c55e', 5, TRUE, FALSE),
    ('Lost', 'lost', '#ef4444', 6, FALSE, TRUE)
) AS stage(name, slug, color, position, is_closed_won, is_closed_lost)
WHERE NOT EXISTS (
  SELECT 1 FROM pipeline_stages ps WHERE ps.company_id = c.id
);
