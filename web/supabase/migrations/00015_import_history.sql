-- Migration: Add import_history table for tracking contact imports
-- This table stores metadata about CSV imports

-- Create import_history table
CREATE TABLE IF NOT EXISTS public.import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'partial', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_import_history_company_id ON public.import_history(company_id);
CREATE INDEX IF NOT EXISTS idx_import_history_created_at ON public.import_history(created_at DESC);

-- Enable RLS
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see imports from their company
CREATE POLICY "Users can view their company's import history"
  ON public.import_history
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert import history for their company"
  ON public.import_history
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company's import history"
  ON public.import_history
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  );

-- Grant permissions
GRANT ALL ON public.import_history TO authenticated;
GRANT ALL ON public.import_history TO service_role;
