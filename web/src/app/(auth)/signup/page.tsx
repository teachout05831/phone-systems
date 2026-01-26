import Link from 'next/link'
import { AuthForm } from '@/components/auth/auth-form'

export default function SignUpPage() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Create Account</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Get started with Outreach System
        </p>
      </div>

      <AuthForm mode="signup" />

      <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
          Sign in
        </Link>
      </p>
    </div>
  )
}
