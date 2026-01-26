-- ============================================
-- FIX: Infinite recursion in company_members policy
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop ALL existing policies on company_members
DROP POLICY IF EXISTS "Users can view company members" ON public.company_members;
DROP POLICY IF EXISTS "Users can add company members" ON public.company_members;

-- Simple policy: users can see memberships where they are the user
CREATE POLICY "Users can view own memberships"
  ON public.company_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Simple policy: users can insert if they are adding themselves
CREATE POLICY "Users can add themselves to company"
  ON public.company_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- For viewing other members in same company, we use a function to avoid recursion
CREATE OR REPLACE FUNCTION public.get_user_company_ids(p_user_id UUID)
RETURNS SETOF UUID AS $$
  SELECT company_id FROM public.company_members WHERE user_id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Now add policy to view all members of companies user belongs to
CREATE POLICY "Users can view members of their companies"
  ON public.company_members FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT public.get_user_company_ids(auth.uid())));
