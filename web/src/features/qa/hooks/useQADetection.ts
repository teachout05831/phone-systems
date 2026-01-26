'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { CreateQAIssueInput } from '../types'
import { getSeverityFromError, SECRET_PATTERNS, shouldIgnoreError } from './detection-patterns'

export interface DetectedIssue extends CreateQAIssueInput { id: string; synced: boolean }

export function useQADetection(enabled: boolean) {
  const [issues, setIssues] = useState<DetectedIssue[]>([])
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const originalConsoleError = useRef<typeof console.error | null>(null)

  const addIssue = useCallback((issue: Omit<DetectedIssue, 'id' | 'synced'>) => {
    setIssues(prev => {
      if (prev.some(i => i.title === issue.title && i.issueType === issue.issueType && i.pagePath === issue.pagePath)) return prev
      return [...prev, { ...issue, id: crypto.randomUUID(), synced: false }]
    })
  }, [])

  // Console error detection
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    originalConsoleError.current = console.error
    console.error = (...args: unknown[]) => {
      originalConsoleError.current?.apply(console, args)
      const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
      if (shouldIgnoreError(msg)) return
      const error = args.find(a => a instanceof Error) as Error | undefined
      addIssue({
        pagePath: window.location.pathname, issueType: 'console_error', severity: getSeverityFromError(error || msg),
        title: msg.slice(0, 100) + (msg.length > 100 ? '...' : ''), description: msg, stackTrace: error?.stack,
        userAgent: navigator.userAgent, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
      })
    }
    return () => { if (originalConsoleError.current) console.error = originalConsoleError.current }
  }, [enabled, addIssue])

  // Security scanning
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    const check = () => {
      const html = document.documentElement.innerHTML
      SECRET_PATTERNS.forEach(({ pattern, name }) => {
        if (pattern.test(html)) addIssue({ pagePath: window.location.pathname, issueType: 'security_issue', severity: 'critical', title: `Exposed ${name} in DOM`, description: `Found ${name} exposed in page HTML.` })
      })
    }
    const t = setTimeout(check, 1000)
    return () => clearTimeout(t)
  }, [enabled, addIssue])

  // Performance monitoring
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    const check = () => {
      const entries = performance.getEntriesByType('navigation')
      if (!entries.length) return
      const loadTime = (entries[0] as PerformanceNavigationTiming).loadEventEnd - (entries[0] as PerformanceNavigationTiming).startTime
      if (loadTime > 3000) addIssue({ pagePath: window.location.pathname, issueType: 'performance_issue', severity: loadTime > 5000 ? 'high' : 'medium', title: `Slow page load: ${Math.round(loadTime)}ms`, description: `Page took ${Math.round(loadTime)}ms (threshold: 3000ms)` })
    }
    if (document.readyState === 'complete') setTimeout(check, 100)
    else window.addEventListener('load', () => setTimeout(check, 100))
  }, [enabled, addIssue])

  const syncIssues = useCallback(async () => {
    const unsynced = issues.filter(i => !i.synced)
    if (!unsynced.length) return
    setIsSyncing(true)
    const syncedIds: string[] = []
    for (const issue of unsynced) {
      try { if ((await fetch('/api/qa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(issue) })).ok) syncedIds.push(issue.id) } catch {}
    }
    if (syncedIds.length) { setIssues(prev => prev.map(i => syncedIds.includes(i.id) ? { ...i, synced: true } : i)); setLastSync(new Date()) }
    setIsSyncing(false)
  }, [issues])

  const clearSynced = useCallback(() => setIssues(prev => prev.filter(i => !i.synced)), [])

  return { issues, isSyncing, lastSync, syncIssues, clearSynced }
}
