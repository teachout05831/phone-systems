'use client'

import { useState } from 'react'
import type { CallNote } from '../types'

interface Props {
  notes: CallNote[]
  onAddNote: (content: string) => Promise<{ success?: boolean; error?: string }>
  disabled?: boolean
}

export function CallNoteInput({ notes, onAddNote, disabled }: Props) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!value.trim() || saving) return
    setSaving(true)
    const result = await onAddNote(value.trim())
    if (result.success) {
      setValue('')
    }
    setSaving(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    }
  }

  if (notes.length > 0) {
    return (
      <div className="space-y-2">
        {notes.map((note) => (
          <div
            key={note.id}
            className="flex items-start gap-2 rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50"
          >
            <span className="text-zinc-400">📝</span>
            <div className="flex-1">
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{note.content}</p>
              <p className="mt-1 text-xs text-zinc-400">
                {note.authorName && `${note.authorName} · `}
                {new Date(note.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Add notes..."
        disabled={disabled || saving}
        className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
      />
      <button
        onClick={handleSave}
        disabled={disabled || saving || !value.trim()}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? '...' : 'Save'}
      </button>
    </div>
  )
}
