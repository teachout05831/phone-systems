'use client'

import { useState, useCallback } from 'react'
import type { ParsedCSV, ColumnMapping, PreviewContact, ImportResult, ContactField } from '../types'
import { parseCSV, readFileAsText, applyMappingAndValidate } from '../utils'
import { importContacts } from '../actions'

export type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete'

export function useImport() {
  const [step, setStep] = useState<ImportStep>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [parsedCSV, setParsedCSV] = useState<ParsedCSV | null>(null)
  const [mappings, setMappings] = useState<ColumnMapping[]>([])
  const [preview, setPreview] = useState<PreviewContact[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setError(null)
    setIsProcessing(true)
    try {
      const text = await readFileAsText(selectedFile)
      const parsed = parseCSV(text)
      if (parsed.rows.length === 0) {
        setError('No data rows found in file')
        return
      }
      setFile(selectedFile)
      setParsedCSV(parsed)
      // Auto-detect mappings
      const autoMappings = autoDetectMappings(parsed.columns.map(c => c.header))
      setMappings(autoMappings)
      setStep('mapping')
    } catch {
      setError('Failed to parse CSV file')
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const updateMapping = useCallback((csvColumn: string, contactField: ContactField | null) => {
    setMappings(prev => prev.map(m =>
      m.csvColumn === csvColumn ? { ...m, contactField } : m
    ))
  }, [])

  const generatePreview = useCallback(() => {
    if (!parsedCSV) return
    const previewRows = parsedCSV.rows.slice(0, 10).map(row =>
      applyMappingAndValidate(row.rowNumber, row.data, mappings)
    )
    setPreview(previewRows)
    setStep('preview')
  }, [parsedCSV, mappings])

  const startImport = useCallback(async () => {
    if (!parsedCSV) return
    setStep('importing')
    setIsProcessing(true)
    try {
      const contacts = parsedCSV.rows.map(row => {
        const mapped = applyMappingAndValidate(row.rowNumber, row.data, mappings)
        return {
          first_name: mapped.first_name,
          last_name: mapped.last_name,
          phone: mapped.phone,
          email: mapped.email,
          business_name: mapped.business_name,
        }
      }).filter(c => c.phone)

      const importResult = await importContacts({ contacts, source: 'csv_import' })
      setResult(importResult)
      setStep('complete')
    } catch {
      setError('Import failed')
    } finally {
      setIsProcessing(false)
    }
  }, [parsedCSV, mappings])

  const reset = useCallback(() => {
    setStep('upload')
    setFile(null)
    setParsedCSV(null)
    setMappings([])
    setPreview([])
    setResult(null)
    setError(null)
  }, [])

  return {
    step, file, parsedCSV, mappings, preview, result, error, isProcessing,
    handleFileSelect, updateMapping, generatePreview, startImport, reset, setStep
  }
}

function autoDetectMappings(headers: string[]): ColumnMapping[] {
  const fieldMap: Record<string, ContactField> = {
    'first name': 'first_name', 'firstname': 'first_name', 'first': 'first_name',
    'last name': 'last_name', 'lastname': 'last_name', 'last': 'last_name',
    'phone': 'phone', 'phone number': 'phone', 'mobile': 'phone', 'cell': 'phone',
    'email': 'email', 'email address': 'email',
    'company': 'business_name', 'business': 'business_name', 'business name': 'business_name',
  }
  return headers.map(header => ({
    csvColumn: header,
    contactField: fieldMap[header.toLowerCase().trim()] || null,
  }))
}
