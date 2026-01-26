'use client'

import { useImport } from '../hooks'
import { FileUploadStep } from './FileUploadStep'
import { ColumnMappingStep } from './ColumnMappingStep'
import { PreviewStep } from './PreviewStep'
import { ImportProgressStep } from './ImportProgressStep'

const STEPS = [
  { key: 'upload', label: 'Upload' },
  { key: 'mapping', label: 'Map Columns' },
  { key: 'preview', label: 'Preview' },
  { key: 'importing', label: 'Import' },
] as const

export function ImportPage() {
  const {
    step, parsedCSV, mappings, preview, result, error, isProcessing,
    handleFileSelect, updateMapping, generatePreview, startImport, reset, setStep
  } = useImport()

  const currentStepIndex = STEPS.findIndex(s => s.key === step || (step === 'complete' && s.key === 'importing'))

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-8">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
              i < currentStepIndex
                ? 'bg-green-500 text-white'
                : i === currentStepIndex
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400'
            }`}>
              {i < currentStepIndex ? '✓' : i + 1}
            </div>
            <span className={`ml-2 text-sm ${
              i <= currentStepIndex
                ? 'text-zinc-900 dark:text-white font-medium'
                : 'text-zinc-400 dark:text-zinc-500'
            }`}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`w-12 h-0.5 mx-3 ${
                i < currentStepIndex ? 'bg-green-500' : 'bg-zinc-200 dark:bg-zinc-700'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
        {step === 'upload' && (
          <FileUploadStep
            onFileSelect={handleFileSelect}
            isProcessing={isProcessing}
            error={error}
          />
        )}

        {step === 'mapping' && parsedCSV && (
          <ColumnMappingStep
            columns={parsedCSV.columns}
            mappings={mappings}
            onUpdateMapping={updateMapping}
            onNext={generatePreview}
            onBack={() => setStep('upload')}
          />
        )}

        {step === 'preview' && parsedCSV && (
          <PreviewStep
            preview={preview}
            totalRows={parsedCSV.totalRows}
            onImport={startImport}
            onBack={() => setStep('mapping')}
          />
        )}

        {(step === 'importing' || step === 'complete') && (
          <ImportProgressStep
            isProcessing={isProcessing}
            result={result}
            error={error}
            onReset={reset}
          />
        )}
      </div>
    </div>
  )
}
