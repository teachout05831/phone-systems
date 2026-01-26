'use client'

import type { CSVColumn, ColumnMapping, ContactField, ContactFieldConfig } from '../types'
import { CONTACT_FIELDS } from '../types'

interface Props {
  columns: CSVColumn[]
  mappings: ColumnMapping[]
  onUpdateMapping: (csvColumn: string, contactField: ContactField | null) => void
  onNext: () => void
  onBack: () => void
}

export function ColumnMappingStep({ columns, mappings, onUpdateMapping, onNext, onBack }: Props) {
  const hasPhoneMapping = mappings.some(m => m.contactField === 'phone')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Map Columns</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Match your CSV columns to contact fields. Phone is required.
        </p>
      </div>

      {!hasPhoneMapping && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm text-amber-700 dark:text-amber-400">
          Please map a column to Phone - this field is required.
        </div>
      )}

      <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-zinc-50 dark:bg-zinc-800">
            <tr>
              <th className="text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 px-4 py-3">CSV Column</th>
              <th className="text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 px-4 py-3">Sample Values</th>
              <th className="text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 px-4 py-3">Map To</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700">
            {columns.map((col) => {
              const mapping = mappings.find(m => m.csvColumn === col.header)
              return (
                <tr key={col.index} className="bg-white dark:bg-zinc-900">
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm text-zinc-900 dark:text-white">{col.header}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      {col.sampleValues.slice(0, 2).join(', ') || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={mapping?.contactField || ''}
                      onChange={(e) => onUpdateMapping(col.header, (e.target.value || null) as ContactField | null)}
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    >
                      <option value="">Skip column</option>
                      {CONTACT_FIELDS.map((field: ContactFieldConfig) => (
                        <option key={field.field} value={field.field}>
                          {field.label} {field.required && '*'}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between pt-4">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!hasPhoneMapping}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Preview Import
        </button>
      </div>
    </div>
  )
}
