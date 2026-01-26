import type { CSVColumn, ParsedCSV, ParsedRow } from '../types'

/**
 * Parse CSV text into structured data
 */
export function parseCSV(text: string): ParsedCSV {
  const lines = text.split(/\r?\n/).filter(line => line.trim())
  if (lines.length === 0) {
    return { headers: [], columns: [], rows: [], totalRows: 0, validRows: 0, errorRows: 0 }
  }

  // Parse headers from first line
  const headers = parseCSVLine(lines[0])

  // Build columns with sample values
  const columns: CSVColumn[] = headers.map((header, index) => ({
    index,
    header: header.trim(),
    sampleValues: [],
  }))

  // Parse data rows
  const rows: ParsedRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const data: Record<string, string> = {}

    headers.forEach((header, index) => {
      data[header.trim()] = values[index]?.trim() || ''
      // Collect sample values (first 3 non-empty)
      if (columns[index].sampleValues.length < 3 && values[index]?.trim()) {
        columns[index].sampleValues.push(values[index].trim())
      }
    })

    rows.push({
      rowNumber: i + 1,
      data,
      errors: [],
      isValid: true,
    })
  }

  return {
    headers,
    columns,
    rows,
    totalRows: rows.length,
    validRows: rows.length,
    errorRows: 0,
  }
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++ // Skip next quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }

  result.push(current)
  return result
}

/**
 * Read file as text
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}
