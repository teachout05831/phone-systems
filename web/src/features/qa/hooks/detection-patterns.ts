import type { QAIssueSeverity } from '../types'

export function getSeverityFromError(error: Error | string): QAIssueSeverity {
  const errorStr = typeof error === 'string' ? error : error.message
  const lower = errorStr.toLowerCase()
  if (lower.includes('critical') || lower.includes('fatal')) return 'critical'
  if (lower.includes('security') || lower.includes('api key') || lower.includes('token')) return 'critical'
  if (lower.includes('typeerror') || lower.includes('referenceerror')) return 'high'
  return 'medium'
}

export const SECRET_PATTERNS = [
  { pattern: /sk[-_]live[-_][a-zA-Z0-9]{20,}/g, name: 'Stripe Live Key' },
  { pattern: /sk[-_]test[-_][a-zA-Z0-9]{20,}/g, name: 'Stripe Test Key' },
  { pattern: /AKIA[0-9A-Z]{16}/g, name: 'AWS Access Key' },
  { pattern: /AIza[0-9A-Za-z\-_]{35}/g, name: 'Google API Key' },
  { pattern: /ghp_[0-9a-zA-Z]{36}/g, name: 'GitHub Token' },
]

export const IGNORED_ERRORS = ['Hydration', 'Warning:', '[Fast Refresh]']

export function shouldIgnoreError(message: string): boolean {
  return IGNORED_ERRORS.some(ignored => message.includes(ignored))
}
