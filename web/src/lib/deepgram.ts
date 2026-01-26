// Deepgram types and utilities for client-side use
// The actual Deepgram connection is handled by server.ts

export interface TranscriptEntry {
  text: string;
  timestamp: string;
  isFinal: boolean;
  speaker?: 'rep' | 'customer' | 'contact';
}

export interface TranscriptMessage {
  type: 'transcript';
  callSid: string;
  text: string;
  isFinal: boolean;
  timestamp: string;
}

export interface FullTranscriptMessage {
  type: 'full_transcript';
  callSid: string;
  transcript: TranscriptEntry[];
}

// Format transcript for display
export function formatTranscript(entries: TranscriptEntry[]): string {
  return entries
    .filter((e) => e.isFinal)
    .map((e) => e.text)
    .join(' ');
}

// Get transcript summary (last N words)
export function getTranscriptSummary(entries: TranscriptEntry[], wordCount: number = 50): string {
  const fullText = formatTranscript(entries);
  const words = fullText.split(' ');
  if (words.length <= wordCount) {
    return fullText;
  }
  return '...' + words.slice(-wordCount).join(' ');
}
