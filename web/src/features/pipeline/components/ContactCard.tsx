'use client'

import Link from 'next/link'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { PipelineContact } from '../types'
import { cn } from '@/lib/utils'

interface Props {
  contact: PipelineContact
  isOverlay?: boolean
}

export function ContactCard({ contact, isOverlay = false }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: contact.id,
    data: { contact },
    disabled: isOverlay,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
  }

  const displayName =
    contact.firstName || contact.lastName
      ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
      : 'Unknown'

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No activity'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      {...(isOverlay ? {} : attributes)}
      {...(isOverlay ? {} : listeners)}
      className={cn(
        'bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700',
        'p-3 shadow-sm',
        !isOverlay && 'cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow',
        isDragging && !isOverlay && 'opacity-50 shadow-lg',
        isOverlay && 'shadow-xl rotate-2'
      )}
    >
      <Link
        href={`/contacts/${contact.id}`}
        className="block"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-medium text-zinc-900 dark:text-white truncate">{displayName}</div>
        {contact.businessName && (
          <div className="text-sm text-zinc-600 dark:text-zinc-400 truncate">
            {contact.businessName}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
          <span>{contact.phone}</span>
          <span>{formatDate(contact.lastActivityAt)}</span>
        </div>
      </Link>
    </div>
  )
}
