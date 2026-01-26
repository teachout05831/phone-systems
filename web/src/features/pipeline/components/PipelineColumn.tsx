'use client'

import { useDroppable } from '@dnd-kit/core'
import type { PipelineContact, ColumnConfig } from '../types'
import { ContactCard } from './ContactCard'
import { cn } from '@/lib/utils'

interface Props {
  config: ColumnConfig
  contacts: PipelineContact[]
  count: number
}

export function PipelineColumn({ config, contacts, count }: Props) {
  const { isOver, setNodeRef } = useDroppable({
    id: config.id,
  })

  return (
    <div className="flex flex-col w-72 flex-shrink-0">
      {/* Column Header */}
      <div className="flex items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-t-lg border border-b-0 border-zinc-200 dark:border-zinc-700">
        <div className={cn('w-3 h-3 rounded-full', config.color)} />
        <h3 className="font-medium text-zinc-900 dark:text-white">{config.title}</h3>
        <span className="ml-auto bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs font-medium px-2 py-0.5 rounded-full">
          {count}
        </span>
      </div>

      {/* Droppable Area */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 min-h-96 p-2 space-y-2 rounded-b-lg border border-zinc-200 dark:border-zinc-700',
          'bg-zinc-100/50 dark:bg-zinc-900/50 overflow-y-auto',
          isOver && 'ring-2 ring-blue-500 ring-inset bg-blue-50 dark:bg-blue-900/20'
        )}
      >
        {contacts.map((contact) => (
          <ContactCard key={contact.id} contact={contact} />
        ))}
        {contacts.length === 0 && (
          <div className="text-center py-8 text-sm text-zinc-400">No contacts</div>
        )}
      </div>
    </div>
  )
}
