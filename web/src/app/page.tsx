import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LandingPage from '@/components/LandingPage'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If logged in, go to dashboard
  if (user) {
    redirect('/dashboard')
  }

  // Otherwise show landing page
  return <LandingPage />
}
