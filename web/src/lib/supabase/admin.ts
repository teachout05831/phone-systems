import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Admin client singleton for service-role operations
// Used for QA issue submissions that may not have user auth
let adminClient: SupabaseClient | null = null

export function createAdminClient(): SupabaseClient {
  if (!adminClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase admin credentials (SUPABASE_SERVICE_ROLE_KEY)')
    }

    adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }

  return adminClient
}
