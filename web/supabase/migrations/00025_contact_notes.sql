-- ============================================
-- CONTACT NOTES TABLE
-- General notes attached to contacts (not tied to specific calls)
-- ============================================

-- Create contact_notes table
CREATE TABLE IF NOT EXISTS public.contact_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Note content
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add company_id column if table already exists (for existing deployments)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'contact_notes'
                 AND column_name = 'company_id') THEN
    ALTER TABLE public.contact_notes ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contact_notes_contact ON public.contact_notes(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_notes_company ON public.contact_notes(company_id);
CREATE INDEX IF NOT EXISTS idx_contact_notes_created_at ON public.contact_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_notes_pinned ON public.contact_notes(is_pinned) WHERE is_pinned = true;

-- Enable RLS
ALTER TABLE public.contact_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access notes for contacts in their company

-- View policy
CREATE POLICY "Users can view contact notes for their company contacts"
  ON public.contact_notes FOR SELECT
  USING (
    contact_id IN (
      SELECT id FROM public.contacts WHERE company_id IN (
        SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
      )
    )
  );

-- Insert policy
CREATE POLICY "Users can add notes to their company contacts"
  ON public.contact_notes FOR INSERT
  WITH CHECK (
    contact_id IN (
      SELECT id FROM public.contacts WHERE company_id IN (
        SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
      )
    )
  );

-- Update policy
CREATE POLICY "Users can update notes for their company contacts"
  ON public.contact_notes FOR UPDATE
  USING (
    contact_id IN (
      SELECT id FROM public.contacts WHERE company_id IN (
        SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
      )
    )
  );

-- Delete policy
CREATE POLICY "Users can delete notes for their company contacts"
  ON public.contact_notes FOR DELETE
  USING (
    contact_id IN (
      SELECT id FROM public.contacts WHERE company_id IN (
        SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
      )
    )
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_contact_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contact_notes_updated_at
  BEFORE UPDATE ON public.contact_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_contact_notes_updated_at();
