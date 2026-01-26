'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface TranscriptSegment {
  index: number;
  speaker: string;
  text: string;
  timestamp: string;
}

interface CallDetail {
  id: string;
  external_call_id: string;
  direction: 'inbound' | 'outbound';
  phone_number: string;
  from_number: string;
  status: string;
  duration_seconds: number;
  outcome: string | null;
  has_recording: boolean;
  recording_url: string | null;
  ai_summary: Record<string, unknown> | null;
  started_at: string;
  ended_at: string | null;
  contact: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string;
    business_name: string | null;
  } | null;
  rep: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}

interface CallTranscript {
  id: string;
  segments: TranscriptSegment[];
  full_text: string;
  word_count: number;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function CallDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [call, setCall] = useState<CallDetail | null>(null);
  const [transcript, setTranscript] = useState<CallTranscript | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCallDetails() {
      const supabase = createClient();
      const callId = params.id as string;

      // Fetch call details
      const { data: callData, error: callError } = await supabase
        .from('calls')
        .select(`
          id,
          external_call_id,
          direction,
          phone_number,
          from_number,
          status,
          duration_seconds,
          outcome,
          has_recording,
          recording_url,
          ai_summary,
          started_at,
          ended_at,
          contact:contacts(id, first_name, last_name, email, phone, business_name),
          rep:profiles!calls_rep_id_fkey(id, full_name, email)
        `)
        .eq('id', callId)
        .single();

      if (callError) {
        console.error('Error fetching call:', callError);
        setLoading(false);
        return;
      }

      setCall(callData as unknown as CallDetail);

      // Fetch transcript
      const { data: transcriptData } = await supabase
        .from('call_transcripts')
        .select('id, segments, full_text, word_count')
        .eq('call_id', callId)
        .single();

      if (transcriptData) {
        setTranscript(transcriptData as CallTranscript);
      }

      setLoading(false);
    }

    fetchCallDetails();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!call) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">Call not found</h2>
        <p className="text-zinc-500 dark:text-zinc-400 mb-4">
          This call may have been deleted or you don&apos;t have permission to view it.
        </p>
        <button
          onClick={() => router.push('/calls')}
          className="text-blue-600 hover:text-blue-700"
        >
          Back to Call History
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/calls')}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-zinc-600 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              Call Details
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {formatDate(call.started_at)}
            </p>
          </div>
        </div>

        {call.contact && (
          <Link
            href={`/contacts/${call.contact.id}`}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            View Contact
          </Link>
        )}
      </div>

      {/* Call Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Contact Info */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
            Contact
          </h3>
          {call.contact ? (
            <div>
              <p className="font-semibold text-zinc-900 dark:text-white">
                {call.contact.first_name} {call.contact.last_name}
              </p>
              {call.contact.business_name && (
                <p className="text-sm text-zinc-600 dark:text-zinc-300">{call.contact.business_name}</p>
              )}
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-mono mt-1">
                {call.phone_number}
              </p>
            </div>
          ) : (
            <div>
              <p className="font-semibold text-zinc-900 dark:text-white">Unknown</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-mono">
                {call.phone_number}
              </p>
            </div>
          )}
        </div>

        {/* Call Stats */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
            Call Stats
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-zinc-600 dark:text-zinc-300">Direction</span>
              <span className="text-sm font-medium text-zinc-900 dark:text-white capitalize flex items-center gap-1">
                {call.direction === 'outbound' ? (
                  <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                )}
                {call.direction}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-zinc-600 dark:text-zinc-300">Duration</span>
              <span className="text-sm font-medium text-zinc-900 dark:text-white font-mono">
                {formatDuration(call.duration_seconds || 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-zinc-600 dark:text-zinc-300">Status</span>
              <span className="text-sm font-medium text-zinc-900 dark:text-white capitalize">
                {call.status.replace('_', ' ')}
              </span>
            </div>
            {call.outcome && (
              <div className="flex justify-between">
                <span className="text-sm text-zinc-600 dark:text-zinc-300">Outcome</span>
                <span className="text-sm font-medium text-zinc-900 dark:text-white capitalize">
                  {call.outcome.replace('_', ' ')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Rep Info */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
            Rep
          </h3>
          {call.rep ? (
            <div>
              <p className="font-semibold text-zinc-900 dark:text-white">{call.rep.full_name}</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{call.rep.email}</p>
            </div>
          ) : (
            <p className="text-zinc-500 dark:text-zinc-400">AI Agent</p>
          )}
        </div>
      </div>

      {/* Recording Player */}
      {call.has_recording && call.recording_url && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Recording</h3>
          <audio controls className="w-full">
            <source src={call.recording_url} type="audio/mpeg" />
            Your browser does not support the audio element.
          </audio>
        </div>
      )}

      {/* Transcript */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Transcript</h3>
          {transcript && (
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {transcript.word_count} words
            </span>
          )}
        </div>

        {transcript && transcript.segments.length > 0 ? (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {transcript.segments.map((segment, index) => (
              <div
                key={index}
                className={`flex gap-3 ${
                  segment.speaker === 'rep' ? 'flex-row' : 'flex-row-reverse'
                }`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                    segment.speaker === 'rep'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  }`}
                >
                  {segment.speaker === 'rep' ? 'R' : 'C'}
                </div>
                <div
                  className={`flex-1 p-3 rounded-lg ${
                    segment.speaker === 'rep'
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-zinc-900 dark:text-zinc-100'
                      : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100'
                  }`}
                >
                  <p className="text-sm">{segment.text}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-zinc-500 dark:text-zinc-400 text-center py-8">
            No transcript available for this call
          </p>
        )}
      </div>

      {/* AI Summary */}
      {call.ai_summary && Object.keys(call.ai_summary).length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">AI Summary</h3>
          <div className="prose dark:prose-invert max-w-none">
            <pre className="text-sm whitespace-pre-wrap bg-zinc-50 dark:bg-zinc-700 p-4 rounded-lg">
              {JSON.stringify(call.ai_summary, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
