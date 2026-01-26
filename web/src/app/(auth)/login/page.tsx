import Link from 'next/link'
import { AuthForm } from '@/components/auth/auth-form'

export default function LoginPage() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Welcome Back</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">Sign in to your account</p>
      </div>

      <AuthForm mode="login" />

      <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
          Sign up
        </Link>
      </p>
    </div>
  )
}
