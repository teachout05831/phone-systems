-- Migration: Create leads table for landing page form submissions
-- This stores potential customer inquiries from the marketing landing page

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  source TEXT DEFAULT 'landing_page',
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'closed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on email for lookups
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anonymous inserts (for landing page form)
CREATE POLICY "Allow anonymous lead submissions"
  ON leads
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Policy: Allow authenticated users to view all leads (for admin/sales team)
CREATE POLICY "Allow authenticated users to view leads"
  ON leads
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow authenticated users to update leads
CREATE POLICY "Allow authenticated users to update leads"
  ON leads
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_leads_updated_at();

-- Comment on table
COMMENT ON TABLE leads IS 'Stores lead form submissions from the marketing landing page';
