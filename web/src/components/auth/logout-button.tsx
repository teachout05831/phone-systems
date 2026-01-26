'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface LogoutButtonProps {
  className?: string
}

export function LogoutButton({ className }: LogoutButtonProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className={cn(
        'rounded-lg px-4 py-2 text-sm font-medium',
        'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
        'dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white',
        'transition-colors',
        className
      )}
    >
      Sign Out
    </button>
  )
}
