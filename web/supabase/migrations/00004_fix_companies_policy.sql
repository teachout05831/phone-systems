-- ============================================
-- FIX: Companies INSERT policy
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop existing company policies
DROP POLICY IF EXISTS "Users can create companies" ON public.companies;
DROP POLICY IF EXISTS "Users can view their companies" ON public.companies;

-- Allow any authenticated user to INSERT a company
CREATE POLICY "Authenticated users can create companies"
  ON public.companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow users to view companies they are members of (using the function to avoid recursion)
CREATE POLICY "Users can view their companies"
  ON public.companies FOR SELECT
  TO authenticated
  USING (id IN (SELECT public.get_user_company_ids(auth.uid())));
