'use client';

interface CallTimerProps {
  duration: string;
  isActive: boolean;
}

export function CallTimer({ duration, isActive }: CallTimerProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-2 h-2 rounded-full ${
          isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
        }`}
      />
      <span className="font-mono text-lg tabular-nums">{duration}</span>
    </div>
  );
}
