import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-900">
      <Link href="/" className="mb-8 text-3xl font-extrabold tracking-tight">
        Dial<span className="text-orange-500">Pro</span>
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
