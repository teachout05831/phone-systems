'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ContactCallHistory } from './ContactCallHistory'
import { ContactNotes } from './ContactNotes'
import { deleteContact } from '../actions/deleteContact'
import { updateContact } from '../actions/updateContact'
import { addToQueue } from '@/features/agent-queue/actions/addToQueue'
import type { Contact, ContactCall, ContactActivity, ContactStats, UpdateContactInput, ContactSource, ContactStatus } from '../types'

interface ContactProfilePageProps {
  contact: Contact
  calls: ContactCall[]
  activities: ContactActivity[]
  stats: ContactStats
}

type TabType = 'activity' | 'calls' | 'notes'

export function ContactProfilePage({
  contact,
  calls,
  activities,
  stats,
}: ContactProfilePageProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>('activity')
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAddingToQueue, setIsAddingToQueue] = useState(false)
  const [currentContact, setCurrentContact] = useState<Contact>(contact)

  const displayName = currentContact.firstName || currentContact.lastName
    ? `${currentContact.firstName || ''} ${currentContact.lastName || ''}`.trim()
    : 'Unknown'

  const initials = getInitials(currentContact.firstName, currentContact.lastName)

  const handleAddToQueue = async () => {
    setIsAddingToQueue(true)
    try {
      const result = await addToQueue({ contactIds: [currentContact.id] })
      if (result.success) {
        alert(result.message || `Added to queue successfully`)
      } else {
        alert(result.error || 'Failed to add to queue')
      }
    } catch (error) {
      alert('Failed to add to queue')
    } finally {
      setIsAddingToQueue(false)
    }
  }

  const handleEditSubmit = async (data: UpdateContactInput) => {
    const result = await updateContact(currentContact.id, data)
    if (result.success && result.data) {
      setCurrentContact(result.data)
      setIsEditModalOpen(false)
    } else {
      alert(result.error || 'Failed to update contact')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this contact?')) return

    setIsDeleting(true)
    const result = await deleteContact(currentContact.id)

    if (result.success) {
      router.push('/contacts')
    } else {
      alert(result.error || 'Failed to delete contact')
      setIsDeleting(false)
    }
  }

  const handleCall = () => {
    router.push(`/call?contactId=${currentContact.id}&phone=${encodeURIComponent(currentContact.phone)}`)
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Back Link */}
      <div className="mb-6">
        <Link href="/contacts" className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
          &larr; Back to Contacts
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Profile Card */}
        <div className="space-y-6">
          {/* Profile Header */}
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-6 text-center text-white">
              <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/30 bg-white/20 text-2xl font-bold">
                {initials}
              </div>
              <h1 className="text-xl font-bold">{displayName}</h1>
              {currentContact.businessName && (
                <p className="text-blue-100">{currentContact.jobTitle ? `${currentContact.jobTitle} at ` : ''}{currentContact.businessName}</p>
              )}
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-sm">
                <span className="h-2 w-2 rounded-full bg-green-400" />
                {formatStatus(currentContact.status)}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 border-b border-zinc-200 p-4 dark:border-zinc-700">
              <button onClick={handleCall} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-medium text-white hover:bg-green-700">
                Call
              </button>
              <button
                onClick={handleAddToQueue}
                disabled={isAddingToQueue}
                className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isAddingToQueue ? 'Adding...' : '+ Queue'}
              </button>
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Edit
              </button>
            </div>

            {/* Details */}
            <div className="space-y-3 p-4">
              <DetailItem icon="phone" label="Phone" value={formatPhone(currentContact.phone)} />
              {currentContact.email && <DetailItem icon="email" label="Email" value={currentContact.email} />}
              {currentContact.businessName && <DetailItem icon="business" label="Company" value={currentContact.businessName} />}
              {currentContact.source && <DetailItem icon="source" label="Source" value={formatSource(currentContact.source)} />}
              <DetailItem icon="calendar" label="Added" value={formatDate(currentContact.createdAt)} />
            </div>

            {/* Delete Button */}
            <div className="border-t border-zinc-200 p-4 dark:border-zinc-700">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full rounded-lg border border-red-300 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                {isDeleting ? 'Deleting...' : 'Delete Contact'}
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
            <div className="grid grid-cols-2 gap-4">
              <StatCard label="Total Calls" value={stats.totalCalls} color="blue" />
              <StatCard label="Connected" value={stats.connectedCalls} color="green" />
              <StatCard label="Talk Time" value={formatDuration(stats.totalTalkTime)} color="yellow" />
              <StatCard label="Last Contact" value={stats.lastContactedAt ? formatRelativeDate(stats.lastContactedAt) : 'Never'} />
            </div>
          </div>
        </div>

        {/* Right Column - Tabs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs */}
          <div className="flex gap-1 rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-800">
            <TabButton active={activeTab === 'activity'} onClick={() => setActiveTab('activity')}>Activity</TabButton>
            <TabButton active={activeTab === 'calls'} onClick={() => setActiveTab('calls')}>Calls ({calls.length})</TabButton>
            <TabButton active={activeTab === 'notes'} onClick={() => setActiveTab('notes')}>Notes</TabButton>
          </div>

          {/* Tab Content */}
          {activeTab === 'activity' && (
            <ActivityTimeline activities={activities} />
          )}
          {activeTab === 'calls' && (
            <ContactCallHistory calls={calls} onNewCall={handleCall} />
          )}
          {activeTab === 'notes' && (
            <ContactNotes notes={[]} />
          )}
        </div>
      </div>

      {/* Edit Contact Modal */}
      {isEditModalOpen && (
        <EditContactModal
          contact={currentContact}
          onClose={() => setIsEditModalOpen(false)}
          onSubmit={handleEditSubmit}
        />
      )}
    </div>
  )
}

// Sub-components
function DetailItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  const icons: Record<string, string> = {
    phone: '📱', email: '✉️', business: '🏢', source: '🌐', calendar: '📅',
  }
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-lg dark:bg-zinc-700">
        {icons[icon] || '📌'}
      </div>
      <div>
        <div className="text-xs uppercase text-zinc-500 dark:text-zinc-400">{label}</div>
        <div className="text-zinc-900 dark:text-white">{value}</div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  const colorClass = color === 'blue' ? 'text-blue-600' : color === 'green' ? 'text-green-600' : color === 'yellow' ? 'text-yellow-600' : 'text-zinc-900 dark:text-white'
  return (
    <div className="rounded-lg bg-zinc-50 p-3 text-center dark:bg-zinc-700/50">
      <div className={`text-xl font-bold ${colorClass}`}>{value}</div>
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active ? 'bg-blue-600 text-white' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700'
      }`}
    >
      {children}
    </button>
  )
}

function ActivityTimeline({ activities }: { activities: ContactActivity[] }) {
  if (activities.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-700 dark:bg-zinc-800">
        <p className="text-zinc-500 dark:text-zinc-400">No activity yet.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
      <div className="border-b border-zinc-200 p-4 dark:border-zinc-700">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Activity Timeline</h3>
      </div>
      <div className="divide-y divide-zinc-200 p-4 dark:divide-zinc-700">
        {activities.map((activity) => (
          <div key={activity.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${getActivityStyle(activity.type)}`}>
              {getActivityIcon(activity.type)}
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <span className="font-medium text-zinc-900 dark:text-white">{activity.title}</span>
                <span className="text-xs text-zinc-400">{formatRelativeDate(activity.createdAt)}</span>
              </div>
              {activity.description && (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{activity.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Helpers
function getInitials(firstName: string | null, lastName: string | null): string {
  const first = firstName?.charAt(0)?.toUpperCase() || ''
  const last = lastName?.charAt(0)?.toUpperCase() || ''
  return first + last || '?'
}

function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
  }
  return phone
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function formatSource(source: string): string {
  return source.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  return `${hours}h ${mins % 60}m`
}

function getActivityIcon(type: string): string {
  const icons: Record<string, string> = { call: '📞', note: '📝', email: '✉️', stage_change: '🎯', created: '➕', updated: '✏️' }
  return icons[type] || '📌'
}

function getActivityStyle(type: string): string {
  const styles: Record<string, string> = {
    call: 'bg-green-100 dark:bg-green-900/30', note: 'bg-yellow-100 dark:bg-yellow-900/30',
    email: 'bg-blue-100 dark:bg-blue-900/30', stage_change: 'bg-purple-100 dark:bg-purple-900/30',
    created: 'bg-zinc-100 dark:bg-zinc-700', updated: 'bg-zinc-100 dark:bg-zinc-700',
  }
  return styles[type] || 'bg-zinc-100 dark:bg-zinc-700'
}

// Edit Contact Modal Component
interface EditContactModalProps {
  contact: Contact
  onClose: () => void
  onSubmit: (data: UpdateContactInput) => Promise<void>
}

function EditContactModal({ contact, onClose, onSubmit }: EditContactModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    firstName: contact.firstName || '',
    lastName: contact.lastName || '',
    phone: contact.phone,
    phoneSecondary: contact.phoneSecondary || '',
    email: contact.email || '',
    businessName: contact.businessName || '',
    jobTitle: contact.jobTitle || '',
    source: contact.source || 'manual',
    status: contact.status,
    notes: contact.notes || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    await onSubmit(formData)
    setIsLoading(false)
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
            Edit Contact
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                First Name
              </label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Last Name
              </label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Phone *
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Secondary Phone
            </label>
            <input
              type="tel"
              name="phoneSecondary"
              value={formData.phoneSecondary}
              onChange={handleChange}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Business Name
              </label>
              <input
                type="text"
                name="businessName"
                value={formData.businessName}
                onChange={handleChange}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Job Title
              </label>
              <input
                type="text"
                name="jobTitle"
                value={formData.jobTitle}
                onChange={handleChange}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Source
              </label>
              <select
                name="source"
                value={formData.source}
                onChange={handleChange}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
              >
                <option value="manual">Manual Entry</option>
                <option value="facebook_ads">Facebook Ads</option>
                <option value="google_ads">Google Ads</option>
                <option value="website">Website</option>
                <option value="referral">Referral</option>
                <option value="cold_email">Cold Email</option>
                <option value="import">Import</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="engaged">Engaged</option>
                <option value="qualified">Qualified</option>
                <option value="closed_won">Closed Won</option>
                <option value="closed_lost">Closed Lost</option>
                <option value="do_not_contact">Do Not Contact</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
