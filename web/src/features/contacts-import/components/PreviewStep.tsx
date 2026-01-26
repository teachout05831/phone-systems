'use client'

import type { PreviewContact } from '../types'

interface Props {
  preview: PreviewContact[]
  totalRows: number
  onImport: () => void
  onBack: () => void
}

export function PreviewStep({ preview, totalRows, onImport, onBack }: Props) {
  const validCount = preview.filter(p => p.isValid).length
  const errorCount = preview.filter(p => !p.isValid).length

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Preview Import</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Review your data before importing. Showing first 10 of {totalRows} contacts.
        </p>
      </div>

      <div className="flex gap-4">
        <div className="px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{totalRows}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Total Rows</p>
        </div>
        <div className="px-4 py-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{validCount}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Valid (preview)</p>
        </div>
        {errorCount > 0 && (
          <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{errorCount}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Errors (preview)</p>
          </div>
        )}
      </div>

      <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead className="bg-zinc-50 dark:bg-zinc-800">
            <tr>
              <th className="text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 px-4 py-3">#</th>
              <th className="text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 px-4 py-3">Name</th>
              <th className="text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 px-4 py-3">Phone</th>
              <th className="text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 px-4 py-3">Email</th>
              <th className="text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700">
            {preview.map((contact) => (
              <tr
                key={contact.rowNumber}
                className={contact.isValid ? 'bg-white dark:bg-zinc-900' : 'bg-red-50 dark:bg-red-900/10'}
              >
                <td className="px-4 py-3 text-sm text-zinc-500">{contact.rowNumber}</td>
                <td className="px-4 py-3 text-sm text-zinc-900 dark:text-white">
                  {[contact.first_name, contact.last_name].filter(Boolean).join(' ') || '-'}
                </td>
                <td className="px-4 py-3 text-sm font-mono text-zinc-900 dark:text-white">
                  {contact.phone || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                  {contact.email || '-'}
                </td>
                <td className="px-4 py-3">
                  {contact.isValid ? (
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                      Valid
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
                      {contact.errors[0]}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between pt-4">
        <button onClick={onBack} className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
          Back
        </button>
        <button onClick={onImport} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">
          Import {totalRows} Contacts
        </button>
      </div>
    </div>
  )
}
