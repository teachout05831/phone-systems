'use client'

import { useState } from 'react'

interface Note {
  id: string
  content: string
  isPinned: boolean
  createdAt: string
  createdBy: string
  createdByName: string | null
}

interface ContactNotesProps {
  notes: Note[]
  onAddNote?: (content: string, isPinned: boolean) => Promise<void>
  onDeleteNote?: (id: string) => Promise<void>
  onTogglePin?: (id: string) => Promise<void>
}

export function ContactNotes({
  notes,
  onAddNote,
  onDeleteNote,
  onTogglePin,
}: ContactNotesProps) {
  const [newNote, setNewNote] = useState('')
  const [isPinned, setIsPinned] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!newNote.trim() || !onAddNote) return
    setIsSubmitting(true)
    await onAddNote(newNote.trim(), isPinned)
    setNewNote('')
    setIsPinned(false)
    setIsSubmitting(false)
  }

  // Sort notes: pinned first, then by date
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
      <div className="border-b border-zinc-200 p-4 dark:border-zinc-700">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
          Notes
        </h3>
      </div>

      {/* Add Note Form */}
      {onAddNote && (
        <div className="border-b border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a note about this contact..."
            rows={3}
            className="w-full rounded-lg border border-zinc-300 p-3 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
          />
          <div className="mt-3 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              Pin this note
            </label>
            <button
              onClick={handleSubmit}
              disabled={!newNote.trim() || isSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Adding...' : 'Add Note'}
            </button>
          </div>
        </div>
      )}

      {/* Notes List */}
      {sortedNotes.length === 0 ? (
        <div className="p-6 text-center text-zinc-500 dark:text-zinc-400">
          No notes yet. Add your first note above.
        </div>
      ) : (
        <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {sortedNotes.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              onDelete={onDeleteNote}
              onTogglePin={onTogglePin}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface NoteItemProps {
  note: Note
  onDelete?: (id: string) => Promise<void>
  onTogglePin?: (id: string) => Promise<void>
}

function NoteItem({ note, onDelete, onTogglePin }: NoteItemProps) {
  const initials = getInitials(note.createdByName)

  return (
    <div className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            {initials}
          </div>
          <span className="font-medium text-zinc-900 dark:text-white">
            {note.createdByName || 'Unknown'}
          </span>
          {note.isPinned && (
            <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
              Pinned
            </span>
          )}
        </div>
        <span className="text-xs text-zinc-400">{formatDate(note.createdAt)}</span>
      </div>

      <div className={`whitespace-pre-wrap text-zinc-600 dark:text-zinc-300 ${
        note.isPinned ? 'rounded-lg border-l-4 border-yellow-400 bg-yellow-50 p-3 dark:bg-yellow-900/10' : ''
      }`}>
        {note.content}
      </div>

      {(onTogglePin || onDelete) && (
        <div className="mt-2 flex gap-3">
          {onTogglePin && (
            <button
              onClick={() => onTogglePin(note.id)}
              className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              {note.isPinned ? 'Unpin' : 'Pin'}
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => {
                if (confirm('Are you sure you want to delete this note?')) {
                  onDelete(note.id)
                }
              }}
              className="text-xs text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.split(' ')
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}
