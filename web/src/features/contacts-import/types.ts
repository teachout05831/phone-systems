// Contact Import Types

export interface CSVColumn {
  index: number
  header: string
  sampleValues: string[]
}

export interface ColumnMapping {
  csvColumn: string
  contactField: ContactField | null
}

export type ContactField =
  | 'first_name'
  | 'last_name'
  | 'email'
  | 'phone'
  | 'phone_secondary'
  | 'business_name'
  | 'job_title'
  | 'website'
  | 'source'
  | 'notes'
  | 'tags'

export interface ContactFieldConfig {
  field: ContactField
  label: string
  required: boolean
  description: string
}

export const CONTACT_FIELDS: ContactFieldConfig[] = [
  { field: 'first_name', label: 'First Name', required: false, description: 'Contact first name' },
  { field: 'last_name', label: 'Last Name', required: false, description: 'Contact last name' },
  { field: 'phone', label: 'Phone', required: true, description: 'Primary phone number' },
  { field: 'phone_secondary', label: 'Secondary Phone', required: false, description: 'Alternative phone' },
  { field: 'email', label: 'Email', required: false, description: 'Email address' },
  { field: 'business_name', label: 'Business Name', required: false, description: 'Company or business' },
  { field: 'job_title', label: 'Job Title', required: false, description: 'Job title or role' },
  { field: 'website', label: 'Website', required: false, description: 'Website URL' },
  { field: 'source', label: 'Lead Source', required: false, description: 'Where the lead came from' },
  { field: 'notes', label: 'Notes', required: false, description: 'Additional notes' },
  { field: 'tags', label: 'Tags', required: false, description: 'Comma-separated tags' },
]

export interface ParsedRow {
  rowNumber: number
  data: Record<string, string>
  errors: string[]
  isValid: boolean
}

export interface ParsedCSV {
  headers: string[]
  columns: CSVColumn[]
  rows: ParsedRow[]
  totalRows: number
  validRows: number
  errorRows: number
}

export interface ImportPreview {
  contacts: PreviewContact[]
  totalCount: number
  validCount: number
  errorCount: number
  duplicateCount: number
}

export interface PreviewContact {
  rowNumber: number
  first_name: string | null
  last_name: string | null
  phone: string
  email: string | null
  business_name: string | null
  errors: string[]
  isDuplicate: boolean
  isValid: boolean
}

export interface ImportResult {
  success: boolean
  imported: number
  skipped: number
  errors: ImportError[]
}

export interface ImportError {
  rowNumber: number
  phone?: string
  error: string
}

export interface ImportProgress {
  total: number
  processed: number
  imported: number
  errors: number
  status: 'idle' | 'processing' | 'complete' | 'error'
}

export interface ImportHistoryItem {
  id: string
  filename: string
  imported_count: number
  error_count: number
  created_at: string
}
