'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import {
  ScheduleCallbackModal,
  RescheduleCallbackModal,
  CancelCallbackModal,
  CompleteCallbackModal,
} from '@/features/callbacks';
import type { Callback } from '@/features/callbacks';

function formatScheduledTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs < 0) {
    const overdueMins = Math.abs(diffMins);
    if (overdueMins < 60) return `${overdueMins}m overdue`;
    const overdueHours = Math.abs(diffHours);
    if (overdueHours < 24) return `${overdueHours}h overdue`;
    return `${Math.abs(diffDays)}d overdue`;
  }

  if (diffMins < 60) return `in ${diffMins}m`;
  if (diffHours < 24) return `in ${diffHours}h`;
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getPriorityBadge(priority: string) {
  const styles: Record<string, string> = {
    high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    low: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300',
  };
  return styles[priority] || styles.normal;
}

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    in_progress: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    rescheduled: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    cancelled: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300',
    exhausted: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return styles[status] || styles.scheduled;
}

export default function CallbacksPage() {
  const [callbacks, setCallbacks] = useState<Callback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'all' | 'completed'>('pending');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedCallback, setSelectedCallback] = useState<Callback | null>(null);

  async function fetchCallbacks() {
    setLoading(true);
    const supabase = createClient();

    // Get user's company for filtering
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) {
      setLoading(false);
      return;
    }

    let query = supabase
      .from('callbacks')
      .select(`
        id,
        scheduled_at,
        status,
        priority,
        reason,
        notes,
        attempt_count,
        max_attempts,
        assigned_to,
        contact:contacts!contact_id(id, first_name, last_name, phone, business_name),
        assigned_to_profile:profiles!assigned_to(id, full_name)
      `)
      .eq('company_id', membership.company_id)
      .order('scheduled_at', { ascending: true });

    if (filter === 'pending') {
      query = query.in('status', ['scheduled', 'pending', 'rescheduled']);
    } else if (filter === 'completed') {
      query = query.in('status', ['completed', 'cancelled', 'exhausted']);
    }

    const { data, error } = await query.limit(50);

    if (error) {
      console.error('Error fetching callbacks:', error);
    } else {
      setCallbacks(data as unknown as Callback[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchCallbacks();
  }, [filter]);

  const handleCallNow = (callback: Callback) => {
    window.location.href = `/call?contactId=${callback.contact.id}&phone=${encodeURIComponent(callback.contact.phone)}&callbackId=${callback.id}`;
  };

  const handleReschedule = (callback: Callback) => {
    setSelectedCallback(callback);
    setShowRescheduleModal(true);
  };

  const handleCancel = (callback: Callback) => {
    setSelectedCallback(callback);
    setShowCancelModal(true);
  };

  const handleComplete = (callback: Callback) => {
    setSelectedCallback(callback);
    setShowCompleteModal(true);
  };

  const handleModalSuccess = () => {
    fetchCallbacks();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const overdueCallbacks = callbacks.filter(c => new Date(c.scheduled_at) < new Date() && c.status !== 'completed');
  const upcomingCallbacks = callbacks.filter(c => new Date(c.scheduled_at) >= new Date() || c.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Callbacks</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {callbacks.length} callback{callbacks.length !== 1 ? 's' : ''} scheduled
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowScheduleModal(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Schedule Callback
          </button>

          <div className="flex items-center gap-2">
            {(['pending', 'all', 'completed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors capitalize ${
                  filter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Empty State */}
      {callbacks.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 dark:border-zinc-700 dark:bg-zinc-800 text-center">
          <svg className="w-12 h-12 mx-auto text-zinc-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-1">No callbacks scheduled</h3>
          <p className="text-zinc-500 dark:text-zinc-400 mb-4">
            Schedule a callback to follow up with a contact
          </p>
          <button
            onClick={() => setShowScheduleModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Schedule Callback
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overdue Section */}
          {overdueCallbacks.length > 0 && filter !== 'completed' && (
            <div>
              <h2 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Overdue ({overdueCallbacks.length})
              </h2>
              <div className="space-y-3">
                {overdueCallbacks.map((callback) => (
                  <CallbackCard
                    key={callback.id}
                    callback={callback}
                    onCallNow={handleCallNow}
                    onReschedule={handleReschedule}
                    onCancel={handleCancel}
                    onComplete={handleComplete}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming/All Section */}
          {upcomingCallbacks.length > 0 && (
            <div>
              {overdueCallbacks.length > 0 && filter !== 'completed' && (
                <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-3">
                  Upcoming
                </h2>
              )}
              <div className="space-y-3">
                {upcomingCallbacks.map((callback) => (
                  <CallbackCard
                    key={callback.id}
                    callback={callback}
                    onCallNow={handleCallNow}
                    onReschedule={handleReschedule}
                    onCancel={handleCancel}
                    onComplete={handleComplete}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <ScheduleCallbackModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSuccess={handleModalSuccess}
      />
      <RescheduleCallbackModal
        isOpen={showRescheduleModal}
        callback={selectedCallback}
        onClose={() => {
          setShowRescheduleModal(false);
          setSelectedCallback(null);
        }}
        onSuccess={handleModalSuccess}
      />
      <CancelCallbackModal
        isOpen={showCancelModal}
        callback={selectedCallback}
        onClose={() => {
          setShowCancelModal(false);
          setSelectedCallback(null);
        }}
        onSuccess={handleModalSuccess}
      />
      <CompleteCallbackModal
        isOpen={showCompleteModal}
        callback={selectedCallback}
        onClose={() => {
          setShowCompleteModal(false);
          setSelectedCallback(null);
        }}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}

interface CallbackCardProps {
  callback: Callback;
  onCallNow: (cb: Callback) => void;
  onReschedule: (cb: Callback) => void;
  onCancel: (cb: Callback) => void;
  onComplete: (cb: Callback) => void;
}

function CallbackCard({ callback, onCallNow, onReschedule, onCancel, onComplete }: CallbackCardProps) {
  const isOverdue = new Date(callback.scheduled_at) < new Date() && callback.status !== 'completed';
  const isActive = !['completed', 'cancelled', 'exhausted'].includes(callback.status);

  return (
    <div className={`rounded-xl border bg-white p-4 dark:bg-zinc-800 ${
      isOverdue
        ? 'border-red-200 dark:border-red-900/50'
        : 'border-zinc-200 dark:border-zinc-700'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/contacts/${callback.contact.id}`}
              className="font-semibold text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 truncate"
            >
              {callback.contact.first_name} {callback.contact.last_name}
            </Link>
            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getPriorityBadge(callback.priority)}`}>
              {callback.priority}
            </span>
            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadge(callback.status)}`}>
              {callback.status}
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
            {callback.contact.business_name && (
              <span>{callback.contact.business_name}</span>
            )}
            <span className="font-mono">{callback.contact.phone}</span>
          </div>

          {callback.reason && (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              {callback.reason}
            </p>
          )}

          {callback.notes && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 italic">
              Notes: {callback.notes}
            </p>
          )}

          <div className="mt-2 flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
            <span className={isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
              {formatScheduledTime(callback.scheduled_at)}
            </span>
            <span>Attempt {callback.attempt_count}/{callback.max_attempts}</span>
            {callback.assigned_to_profile && (
              <span>Assigned to {callback.assigned_to_profile.full_name}</span>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 flex flex-wrap gap-2 justify-end">
          <Link
            href={`/contacts/${callback.contact.id}`}
            className="px-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
          >
            View
          </Link>
          {isActive && (
            <>
              <button
                onClick={() => onReschedule(callback)}
                className="px-3 py-1.5 text-sm bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
              >
                Reschedule
              </button>
              <button
                onClick={() => onCancel(callback)}
                className="px-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => onComplete(callback)}
                className="px-3 py-1.5 text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
              >
                Complete
              </button>
              <button
                onClick={() => onCallNow(callback)}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Call
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
