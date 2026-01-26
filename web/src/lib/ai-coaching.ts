// AI Coaching types and utilities for client-side use
// The actual AI coaching logic is handled by server.ts

export interface CoachingMessage {
  type: 'ai_coaching';
  callSid: string;
  suggestion: string;
  timestamp: string;
}

export interface CoachingSuggestion {
  id: string;
  suggestion: string;
  timestamp: string;
  dismissed: boolean;
}

// Generate a unique ID for coaching suggestions
export function generateCoachingId(): string {
  return `coaching_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Coaching categories for UI display
export type CoachingCategory =
  | 'objection_handling'
  | 'rapport_building'
  | 'closing'
  | 'discovery'
  | 'general';

// Categorize a coaching suggestion based on keywords
export function categorizeCoaching(suggestion: string): CoachingCategory {
  const lower = suggestion.toLowerCase();

  if (lower.includes('objection') || lower.includes('concern') || lower.includes('hesitat')) {
    return 'objection_handling';
  }
  if (lower.includes('rapport') || lower.includes('connect') || lower.includes('relation')) {
    return 'rapport_building';
  }
  if (lower.includes('close') || lower.includes('commit') || lower.includes('next step') || lower.includes('schedule')) {
    return 'closing';
  }
  if (lower.includes('ask') || lower.includes('question') || lower.includes('learn') || lower.includes('understand')) {
    return 'discovery';
  }

  return 'general';
}

// Get coaching category display info
export function getCategoryInfo(category: CoachingCategory): { label: string; color: string; icon: string } {
  const info: Record<CoachingCategory, { label: string; color: string; icon: string }> = {
    objection_handling: { label: 'Objection', color: 'orange', icon: '🛡️' },
    rapport_building: { label: 'Rapport', color: 'blue', icon: '🤝' },
    closing: { label: 'Close', color: 'green', icon: '🎯' },
    discovery: { label: 'Discovery', color: 'purple', icon: '🔍' },
    general: { label: 'Tip', color: 'gray', icon: '💡' },
  };

  return info[category];
}
