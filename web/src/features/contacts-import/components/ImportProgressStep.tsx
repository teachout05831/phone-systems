'use client'

import Link from 'next/link'
import type { ImportResult } from '../types'

interface Props {
  isProcessing: boolean
  result: ImportResult | null
  error: string | null
  onReset: () => void
}

export function ImportProgressStep({ isProcessing, result, error, onReset }: Props) {
  if (isProcessing) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-6 animate-bounce">
          &#128640;
        </div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
          Importing Contacts...
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Please wait while we process your file
        </p>
        <div className="mt-6 w-64 mx-auto h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 animate-pulse" style={{ width: '60%' }} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-6">&#x26A0;&#xFE0F;</div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">Import Failed</h2>
        <p className="text-sm text-red-600 dark:text-red-400 mb-6">{error}</p>
        <button
          onClick={onReset}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (!result) return null

  return (
    <div className="text-center py-12">
      <div className="text-5xl mb-6">
        {result.success ? '&#x2705;' : '&#x26A0;&#xFE0F;'}
      </div>
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
        {result.success ? 'Import Complete!' : 'Import Completed with Errors'}
      </h2>

      <div className="flex justify-center gap-6 my-8">
        <div className="text-center">
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">{result.imported}</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Imported</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{result.skipped}</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Skipped (duplicates)</p>
        </div>
        {result.errors.length > 0 && (
          <div className="text-center">
            <p className="text-3xl font-bold text-red-600 dark:text-red-400">{result.errors.length}</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Errors</p>
          </div>
        )}
      </div>

      {result.errors.length > 0 && (
        <div className="max-w-md mx-auto mb-8 text-left">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Errors:</p>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 max-h-32 overflow-y-auto">
            {result.errors.slice(0, 5).map((err, i) => (
              <p key={i} className="text-xs text-red-600 dark:text-red-400">
                Row {err.rowNumber}: {err.error}
              </p>
            ))}
            {result.errors.length > 5 && (
              <p className="text-xs text-red-500 mt-1">...and {result.errors.length - 5} more</p>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-center gap-4">
        <Link
          href="/contacts"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
        >
          View Contacts
        </Link>
        <button
          onClick={onReset}
          className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
        >
          Import Another File
        </button>
      </div>
    </div>
  )
}
