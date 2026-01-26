'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function QuickDial() {
  const [phoneNumber, setPhoneNumber] = useState('')
  const router = useRouter()

  const formatPhoneInput = (value: string): string => {
    const cleaned = value.replace(/\D/g, '')
    if (cleaned.length === 0) return ''
    if (cleaned.length <= 3) return `(${cleaned}`
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneInput(e.target.value)
    setPhoneNumber(formatted)
  }

  const handleCall = () => {
    const cleaned = phoneNumber.replace(/\D/g, '')
    if (cleaned.length >= 10) {
      router.push(`/call?phone=${encodeURIComponent('+1' + cleaned)}`)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCall()
    }
  }

  const isValidNumber = phoneNumber.replace(/\D/g, '').length >= 10

  return (
    <div className="space-y-4">
      <div>
        <input
          type="tel"
          value={phoneNumber}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder="+1 (___) ___-____"
          className="w-full px-4 py-3 text-lg rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <button
        onClick={handleCall}
        disabled={!isValidNumber}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:bg-zinc-300 disabled:cursor-not-allowed transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
        Call
      </button>
    </div>
  )
}
