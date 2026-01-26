import type { ColumnMapping, ContactField, PreviewContact } from '../types'

/**
 * Apply column mappings to a row and validate
 */
export function applyMappingAndValidate(
  rowNumber: number,
  data: Record<string, string>,
  mappings: ColumnMapping[]
): PreviewContact {
  const contact: PreviewContact = {
    rowNumber,
    first_name: null,
    last_name: null,
    phone: '',
    email: null,
    business_name: null,
    errors: [],
    isDuplicate: false,
    isValid: true,
  }

  // Apply mappings
  for (const mapping of mappings) {
    if (!mapping.contactField) continue
    const value = data[mapping.csvColumn]?.trim() || ''
    if (!value) continue

    switch (mapping.contactField) {
      case 'first_name': contact.first_name = value; break
      case 'last_name': contact.last_name = value; break
      case 'phone': contact.phone = normalizePhone(value); break
      case 'email': contact.email = value; break
      case 'business_name': contact.business_name = value; break
    }
  }

  // Validate required fields
  if (!contact.phone) {
    contact.errors.push('Phone number is required')
    contact.isValid = false
  } else if (!isValidPhone(contact.phone)) {
    contact.errors.push('Invalid phone number format')
    contact.isValid = false
  }

  // Validate email format if provided
  if (contact.email && !isValidEmail(contact.email)) {
    contact.errors.push('Invalid email format')
    contact.isValid = false
  }

  return contact
}

/**
 * Normalize phone number to E.164-like format
 */
export function normalizePhone(phone: string): string {
  // Remove all non-digit characters except leading +
  let normalized = phone.replace(/[^\d+]/g, '')

  // Handle various formats
  if (normalized.startsWith('+')) {
    return normalized
  }

  // Assume US number if 10 digits
  if (normalized.length === 10) {
    return '+1' + normalized
  }

  // If 11 digits starting with 1, add +
  if (normalized.length === 11 && normalized.startsWith('1')) {
    return '+' + normalized
  }

  return normalized
}

/**
 * Validate phone number format
 */
export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone)
  // Must be at least 10 digits (after normalization)
  return /^\+?\d{10,15}$/.test(normalized)
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
