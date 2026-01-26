'use client'

import Link from 'next/link'
import type { Activity, CallActivity, SMSActivity, CallbackActivity } from '../types'
import { ActivityIcon } from './ActivityIcon'

interface Props {
  activity: Activity
}

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatDate(timestamp: string) {
  const date = new Date(timestamp)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function getOutcomeBadge(outcome: string | null, status: string) {
  const value = outcome || status
  const styles: Record<string, string> = {
    completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    missed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    declined: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    no_answer: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    busy: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  return {
    style: styles[value] || 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300',
    label: value.replace('_', ' '),
  }
}

function CallContent({ activity }: { activity: CallActivity }) {
  const { direction, durationSeconds, outcome, status } = activity.data
  const badge = getOutcomeBadge(outcome, status)
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
      <span className="capitalize">{direction}</span>
      <span>call</span>
      <span className={`px-2 py-0.5 text-xs rounded-full capitalize ${badge.style}`}>{badge.label}</span>
      {durationSeconds > 0 && <span className="font-mono text-xs">{formatDuration(durationSeconds)}</span>}
    </div>
  )
}

function SMSContent({ activity }: { activity: SMSActivity }) {
  const { direction, body } = activity.data
  return (
    <div className="text-sm">
      <div className="text-zinc-500 dark:text-zinc-400 mb-1">
        {direction === 'outbound' ? 'Sent' : 'Received'} SMS
      </div>
      <p className="text-zinc-700 dark:text-zinc-300 line-clamp-2">{body}</p>
    </div>
  )
}

function CallbackContent({ activity }: { activity: CallbackActivity }) {
  const { status, priority } = activity.data
  const priorityStyles: Record<string, string> = {
    high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    low: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300',
  }
  const statusStyles: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    cancelled: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300',
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-zinc-600 dark:text-zinc-400">Callback</span>
      <span className={`px-2 py-0.5 text-xs rounded-full capitalize ${priorityStyles[priority] || priorityStyles.normal}`}>
        {priority}
      </span>
      <span className={`px-2 py-0.5 text-xs rounded-full capitalize ${statusStyles[status] || statusStyles.scheduled}`}>
        {status.replace('_', ' ')}
      </span>
    </div>
  )
}

export function ActivityItem({ activity }: Props) {
  const getContactName = () => {
    if (!activity.contact) return 'Unknown Contact'
    const { firstName, lastName, phone } = activity.contact
    const name = [firstName, lastName].filter(Boolean).join(' ')
    return name || phone
  }

  return (
    <div className="relative flex gap-4 pb-6 pl-10">
      <div className="absolute left-0">
        <ActivityIcon activity={activity} />
      </div>
      <div className="flex-1 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {activity.contact ? (
                <Link
                  href={`/contacts/${activity.contact.id}`}
                  className="font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                >
                  {getContactName()}
                </Link>
              ) : (
                <span className="font-medium text-zinc-900 dark:text-white">{getContactName()}</span>
              )}
            </div>
            {activity.type === 'call' && <CallContent activity={activity} />}
            {activity.type === 'sms' && <SMSContent activity={activity} />}
            {activity.type === 'callback' && <CallbackContent activity={activity} />}
          </div>
          <div className="text-right text-xs text-zinc-500 dark:text-zinc-400 flex-shrink-0">
            <div>{formatDate(activity.timestamp)}</div>
            <div>{formatTime(activity.timestamp)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
