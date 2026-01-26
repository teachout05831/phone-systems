'use client'

import Link from 'next/link'
import { StatsCards } from './StatsCards'
import { RecentCallsList } from './RecentCallsList'
import { CallbacksList } from './CallbacksList'
import { QuickDial } from './QuickDial'
import type { DashboardPageProps } from '../types'

export function DashboardPage({ initialStats, initialRecentCalls, initialCallbacks }: DashboardPageProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Welcome back! Here&apos;s your overview.</p>
      </div>

      {/* Stats Cards */}
      <StatsCards stats={initialStats} />

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Quick Dial Card */}
          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-700">
              <h3 className="font-semibold text-zinc-900 dark:text-white">Quick Dial</h3>
            </div>
            <div className="p-4">
              <QuickDial />
            </div>
          </div>

          {/* Callbacks Due Today */}
          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-700">
              <h3 className="font-semibold text-zinc-900 dark:text-white">
                Callbacks Due Today
                {initialCallbacks.length > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    {initialCallbacks.length}
                  </span>
                )}
              </h3>
              <Link
                href="/callbacks"
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                View All
              </Link>
            </div>
            <div className="p-4">
              <CallbacksList callbacks={initialCallbacks} />
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Recent Calls */}
          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-700">
              <h3 className="font-semibold text-zinc-900 dark:text-white">Recent Calls</h3>
              <Link
                href="/history"
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                View All
              </Link>
            </div>
            <RecentCallsList calls={initialRecentCalls} />
            {initialRecentCalls.length > 0 && (
              <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-700">
                <Link
                  href="/history"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  View Full Call History &rarr;
                </Link>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-700">
              <h3 className="font-semibold text-zinc-900 dark:text-white">Quick Actions</h3>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <Link
                href="/contacts"
                className="flex items-center gap-2 px-4 py-3 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
              >
                <svg className="w-5 h-5 text-zinc-600 dark:text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Contacts</span>
              </Link>
              <Link
                href="/sms"
                className="flex items-center gap-2 px-4 py-3 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
              >
                <svg className="w-5 h-5 text-zinc-600 dark:text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">SMS</span>
              </Link>
              <Link
                href="/pipeline"
                className="flex items-center gap-2 px-4 py-3 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
              >
                <svg className="w-5 h-5 text-zinc-600 dark:text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Pipeline</span>
              </Link>
              <Link
                href="/activity"
                className="flex items-center gap-2 px-4 py-3 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
              >
                <svg className="w-5 h-5 text-zinc-600 dark:text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Activity</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
