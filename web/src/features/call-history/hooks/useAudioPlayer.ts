'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

export type PlaybackSpeed = 0.5 | 1 | 1.5 | 2

interface UseAudioPlayerProps {
  src: string | null
}

export function useAudioPlayer({ src }: UseAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1)

  useEffect(() => {
    if (!src) return

    const audio = new Audio(src)
    audioRef.current = audio

    const handleLoadedMetadata = () => setDuration(audio.duration)
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleEnded = () => setIsPlaying(false)

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
      audio.pause()
    }
  }, [src])

  const play = useCallback(() => {
    audioRef.current?.play()
    setIsPlaying(true)
  }, [])

  const pause = useCallback(() => {
    audioRef.current?.pause()
    setIsPlaying(false)
  }, [])

  const togglePlay = useCallback(() => {
    if (isPlaying) pause()
    else play()
  }, [isPlaying, play, pause])

  const seek = useCallback((time: number) => {
    if (!audioRef.current) return
    audioRef.current.currentTime = time
    setCurrentTime(time)
  }, [])

  const changeVolume = useCallback((newVolume: number) => {
    if (!audioRef.current) return
    const clamped = Math.max(0, Math.min(1, newVolume))
    audioRef.current.volume = clamped
    setVolume(clamped)
  }, [])

  const changeSpeed = useCallback((speed: PlaybackSpeed) => {
    if (!audioRef.current) return
    audioRef.current.playbackRate = speed
    setPlaybackSpeed(speed)
  }, [])

  const skipForward = useCallback((seconds: number = 10) => {
    if (!audioRef.current) return
    const newTime = Math.min(audioRef.current.currentTime + seconds, duration)
    seek(newTime)
  }, [duration, seek])

  const skipBackward = useCallback((seconds: number = 10) => {
    if (!audioRef.current) return
    const newTime = Math.max(audioRef.current.currentTime - seconds, 0)
    seek(newTime)
  }, [seek])

  return {
    isPlaying,
    currentTime,
    duration,
    volume,
    playbackSpeed,
    play,
    pause,
    togglePlay,
    seek,
    changeVolume,
    changeSpeed,
    skipForward,
    skipBackward
  }
}
