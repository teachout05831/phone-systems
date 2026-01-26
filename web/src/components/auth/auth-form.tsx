'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface AuthFormProps {
  mode: 'login' | 'signup'
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (mode === 'signup') {
        // Validate password strength
        if (password.length < 8) {
          setError('Password must be at least 8 characters')
          setLoading(false)
          return
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        })

        if (error) throw error

        setSuccess(true)
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error

        router.push('/dashboard')
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (success && mode === 'signup') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center dark:border-green-800 dark:bg-green-900/20">
        <h3 className="mb-2 text-lg font-semibold text-green-800 dark:text-green-200">
          Check your email
        </h3>
        <p className="text-green-700 dark:text-green-300">
          We sent you a confirmation link. Please check your email to complete sign up.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === 'signup' && (
        <div>
          <label
            htmlFor="fullName"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Full Name
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={cn(
              'w-full rounded-lg border border-zinc-300 px-4 py-2',
              'bg-white text-zinc-900',
              'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
              'dark:border-zinc-600 dark:bg-zinc-800 dark:text-white'
            )}
            placeholder="John Doe"
          />
        </div>
      )}

      <div>
        <label
          htmlFor="email"
          className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={cn(
            'w-full rounded-lg border border-zinc-300 px-4 py-2',
            'bg-white text-zinc-900',
            'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
            'dark:border-zinc-600 dark:bg-zinc-800 dark:text-white'
          )}
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={mode === 'signup' ? 8 : undefined}
          className={cn(
            'w-full rounded-lg border border-zinc-300 px-4 py-2',
            'bg-white text-zinc-900',
            'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
            'dark:border-zinc-600 dark:bg-zinc-800 dark:text-white'
          )}
          placeholder={mode === 'signup' ? 'Min. 8 characters' : 'Your password'}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className={cn(
          'w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white',
          'hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'transition-colors'
        )}
      >
        {loading ? 'Loading...' : mode === 'signup' ? 'Create Account' : 'Sign In'}
      </button>
    </form>
  )
}
