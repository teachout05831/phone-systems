import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface HealthCheck {
  status: 'ok' | 'error'
  message?: string
  latency?: number
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  checks: {
    server: HealthCheck
    supabase: HealthCheck
    environment: HealthCheck
    twilio: HealthCheck
  }
}

// GET: Health check endpoint - no auth required
export async function GET() {
  const startTime = Date.now()

  const response: HealthResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      server: { status: 'ok' },
      supabase: { status: 'ok' },
      environment: { status: 'ok' },
      twilio: { status: 'ok' },
    },
  }

  // Check environment variables
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]

  const missingVars = requiredEnvVars.filter(v => !process.env[v])
  if (missingVars.length > 0) {
    response.checks.environment = {
      status: 'error',
      message: `Missing: ${missingVars.join(', ')}`,
    }
  }

  // Check Twilio env vars (optional but flag if missing)
  const twilioVars = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN']
  const missingTwilio = twilioVars.filter(v => !process.env[v])
  if (missingTwilio.length > 0) {
    response.checks.twilio = {
      status: 'error',
      message: `Missing: ${missingTwilio.join(', ')}`,
    }
  }

  // Check Supabase connectivity
  try {
    const supabaseStart = Date.now()
    const adminClient = createAdminClient()

    // Simple query to check connectivity
    const { error } = await adminClient
      .from('companies')
      .select('id')
      .limit(1)

    if (error) {
      response.checks.supabase = {
        status: 'error',
        message: error.message,
      }
    } else {
      response.checks.supabase = {
        status: 'ok',
        latency: Date.now() - supabaseStart,
      }
    }
  } catch (error) {
    response.checks.supabase = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Connection failed',
    }
  }

  // Determine overall status
  const checks = Object.values(response.checks)
  const hasError = checks.some(c => c.status === 'error')
  const criticalChecks = [response.checks.server, response.checks.supabase]
  const hasCriticalError = criticalChecks.some(c => c.status === 'error')

  if (hasCriticalError) {
    response.status = 'unhealthy'
  } else if (hasError) {
    response.status = 'degraded'
  }

  // Add total response time
  const totalTime = Date.now() - startTime

  return NextResponse.json(
    { ...response, responseTime: totalTime },
    { status: response.status === 'unhealthy' ? 503 : 200 }
  )
}
