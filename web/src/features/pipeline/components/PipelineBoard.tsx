'use client'

import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter } from '@dnd-kit/core'
import { useState } from 'react'
import type { ContactsByStatus, PipelineContact, PipelineStatus } from '../types'
import { COLUMN_CONFIGS } from '../types'
import { usePipeline } from '../hooks/usePipeline'
import { PipelineColumn } from './PipelineColumn'
import { ContactCard } from './ContactCard'

interface Props {
  initialContacts: ContactsByStatus
}

export function PipelineBoard({ initialContacts }: Props) {
  const { contacts, counts, moveContact, isUpdating, error, clearError } = usePipeline({
    initialContacts,
  })

  const [activeContact, setActiveContact] = useState<PipelineContact | null>(null)

  const handleDragStart = (event: DragStartEvent) => {
    const contact = event.active.data.current?.contact as PipelineContact | undefined
    if (contact) setActiveContact(contact)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveContact(null)
    const { active, over } = event

    if (!over) return

    const contactId = active.id as string
    const contact = active.data.current?.contact as PipelineContact | undefined
    const toColumn = over.id as PipelineStatus

    if (contact && contact.status !== toColumn) {
      moveContact(contactId, contact.status as PipelineStatus, toColumn)
    }
  }

  return (
    <div className="h-full">
      {/* Error Toast */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
          <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
          <button
            onClick={clearError}
            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading Indicator */}
      {isUpdating && (
        <div className="mb-4 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <span className="text-sm text-blue-600 dark:text-blue-400">Updating...</span>
        </div>
      )}

      {/* Kanban Board */}
      <DndContext
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMN_CONFIGS.map((config) => (
            <PipelineColumn
              key={config.id}
              config={config}
              contacts={contacts[config.id]}
              count={counts[config.id]}
            />
          ))}
        </div>

        {/* Drag Overlay for smooth dragging */}
        <DragOverlay>
          {activeContact ? <ContactCard contact={activeContact} isOverlay /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
