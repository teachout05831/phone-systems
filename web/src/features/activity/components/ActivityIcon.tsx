'use client'

import type { Activity } from '../types'

interface Props {
  activity: Activity
}

export function ActivityIcon({ activity }: Props) {
  const baseStyles = 'w-10 h-10 rounded-full flex items-center justify-center'

  if (activity.type === 'call') {
    const isOutbound = activity.data.direction === 'outbound'
    return (
      <div className={`${baseStyles} ${isOutbound ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
        <svg className={`w-5 h-5 ${isOutbound ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      </div>
    )
  }

  if (activity.type === 'sms') {
    const isOutbound = activity.data.direction === 'outbound'
    return (
      <div className={`${baseStyles} ${isOutbound ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-indigo-100 dark:bg-indigo-900/30'}`}>
        <svg className={`w-5 h-5 ${isOutbound ? 'text-purple-600 dark:text-purple-400' : 'text-indigo-600 dark:text-indigo-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
    )
  }

  if (activity.type === 'callback') {
    const priorityColors: Record<string, string> = {
      high: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
      normal: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
      low: 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400',
    }
    const colors = priorityColors[activity.data.priority] || priorityColors.normal

    return (
      <div className={`${baseStyles} ${colors.split(' ').slice(0, 2).join(' ')}`}>
        <svg className={`w-5 h-5 ${colors.split(' ').slice(2).join(' ')}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    )
  }

  return null
}
