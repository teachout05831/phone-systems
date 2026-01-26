'use client';

import { CoachingSuggestion, categorizeCoaching, getCategoryInfo } from '@/lib/ai-coaching';

interface CoachingPanelProps {
  suggestions: CoachingSuggestion[];
  onDismiss: (id: string) => void;
  className?: string;
}

export function CoachingPanel({ suggestions, onDismiss, className = '' }: CoachingPanelProps) {
  const activeSuggestions = suggestions.filter((s) => !s.dismissed);

  return (
    <div className={`flex flex-col h-full bg-white rounded-lg shadow ${className}`}>
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <CoachIcon className="w-5 h-5 text-purple-500" />
          AI Coach
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {activeSuggestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <BrainIcon className="w-12 h-12 mb-2" />
            <p className="text-center">AI coaching suggestions will appear here during the call</p>
          </div>
        ) : (
          activeSuggestions.map((suggestion) => (
            <CoachingCard
              key={suggestion.id}
              suggestion={suggestion}
              onDismiss={() => onDismiss(suggestion.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface CoachingCardProps {
  suggestion: CoachingSuggestion;
  onDismiss: () => void;
}

function CoachingCard({ suggestion, onDismiss }: CoachingCardProps) {
  const category = categorizeCoaching(suggestion.suggestion);
  const categoryInfo = getCategoryInfo(category);
  const time = suggestion.timestamp
    ? new Date(suggestion.timestamp).toLocaleTimeString()
    : '';

  const colorClasses: Record<string, string> = {
    orange: 'bg-orange-50 border-orange-200',
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    purple: 'bg-purple-50 border-purple-200',
    gray: 'bg-gray-50 border-gray-200',
  };

  const badgeColorClasses: Record<string, string> = {
    orange: 'bg-orange-100 text-orange-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    purple: 'bg-purple-100 text-purple-700',
    gray: 'bg-gray-100 text-gray-700',
  };

  return (
    <div
      className={`relative p-3 rounded-lg border animate-fade-in ${colorClasses[categoryInfo.color]}`}
    >
      <button
        onClick={onDismiss}
        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600"
        title="Dismiss"
      >
        <XIcon className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-2 mb-2">
        <span className={`px-2 py-0.5 text-xs font-medium rounded ${badgeColorClasses[categoryInfo.color]}`}>
          {categoryInfo.icon} {categoryInfo.label}
        </span>
        {time && (
          <span className="text-xs text-gray-400">{time}</span>
        )}
      </div>

      <p className="text-gray-800 pr-6">{suggestion.suggestion}</p>
    </div>
  );
}

function CoachIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
      />
    </svg>
  );
}

function BrainIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}
