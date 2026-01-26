'use client'

import { useAudioPlayer, type PlaybackSpeed } from '../hooks/useAudioPlayer'

interface AudioPlayerProps {
  src: string | null
  duration: number
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const SPEED_OPTIONS: PlaybackSpeed[] = [0.5, 1, 1.5, 2]

export function AudioPlayer({ src, duration: initialDuration }: AudioPlayerProps) {
  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    playbackSpeed,
    togglePlay,
    seek,
    changeVolume,
    changeSpeed,
    skipBackward,
    skipForward
  } = useAudioPlayer({ src })

  const displayDuration = duration || initialDuration

  if (!src) {
    return (
      <div className="rounded-lg bg-zinc-800 p-4 text-center">
        <p className="text-zinc-400 text-sm">Recording not available</p>
      </div>
    )
  }

  const progress = displayDuration > 0 ? (currentTime / displayDuration) * 100 : 0

  return (
    <div className="rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-zinc-400 uppercase flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          Call Recording
        </span>
        <span className="text-sm text-zinc-300">{formatTime(displayDuration)}</span>
      </div>

      {/* Progress Bar */}
      <div
        className="h-2 bg-zinc-700 rounded-full mb-4 cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const pos = (e.clientX - rect.left) / rect.width
          seek(pos * displayDuration)
        }}
      >
        <div
          className="h-full bg-blue-500 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Skip Back */}
          <button
            onClick={() => skipBackward(10)}
            className="p-2 text-zinc-400 hover:text-white transition-colors"
            title="Skip back 10s"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
            </svg>
          </button>

          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="p-3 bg-blue-600 rounded-full text-white hover:bg-blue-700 transition-colors"
          >
            {isPlaying ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>

          {/* Skip Forward */}
          <button
            onClick={() => skipForward(10)}
            className="p-2 text-zinc-400 hover:text-white transition-colors"
            title="Skip forward 10s"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
            </svg>
          </button>

          {/* Time */}
          <span className="text-sm text-zinc-300 ml-2 font-mono">
            {formatTime(currentTime)} / {formatTime(displayDuration)}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Speed Control */}
          <select
            value={playbackSpeed}
            onChange={(e) => changeSpeed(Number(e.target.value) as PlaybackSpeed)}
            className="px-2 py-1 text-sm bg-zinc-700 text-zinc-300 rounded border-none"
          >
            {SPEED_OPTIONS.map((speed) => (
              <option key={speed} value={speed}>{speed}x</option>
            ))}
          </select>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              className="w-20 accent-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
