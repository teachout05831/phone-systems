'use client'

import { useCallback, useState } from 'react'

interface Props {
  onFileSelect: (file: File) => void
  isProcessing: boolean
  error: string | null
}

export function FileUploadStep({ onFileSelect, isProcessing, error }: Props) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.txt'))) {
      onFileSelect(file)
    }
  }, [onFileSelect])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFileSelect(file)
  }, [onFileSelect])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Upload CSV File</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Upload a CSV file with your contacts. The first row should contain headers.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500'
        }`}
      >
        <input
          type="file"
          accept=".csv,.txt"
          onChange={handleFileInput}
          className="hidden"
          id="csv-upload"
          disabled={isProcessing}
        />
        <label htmlFor="csv-upload" className="cursor-pointer">
          <div className="text-4xl mb-4">
            {isProcessing ? (
              <span className="animate-spin inline-block">&#8635;</span>
            ) : (
              '📄'
            )}
          </div>
          <p className="text-zinc-900 dark:text-white font-medium mb-2">
            {isProcessing ? 'Processing...' : 'Drop your CSV file here'}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            or click to browse
          </p>
          <span className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            Select File
          </span>
        </label>
      </div>

      <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-2">File Requirements</h3>
        <ul className="text-sm text-zinc-500 dark:text-zinc-400 space-y-1">
          <li>CSV format with comma-separated values</li>
          <li>First row must contain column headers</li>
          <li>Phone number column is required</li>
          <li>Maximum file size: 5MB</li>
        </ul>
      </div>
    </div>
  )
}
