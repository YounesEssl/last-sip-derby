'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GameState } from '@last-sip-derby/shared'
import { RaceAudioDirector, type RaceAudioState } from '@/audio/raceAudio'

export function ExperienceControls({ state, activeEventId }: { state: GameState; activeEventId: string | null }) {
  const [soundOn, setSoundOn] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [trackTitle, setTrackTitle] = useState<string | null>(null)
  const audioRef = useRef<RaceAudioDirector | null>(null)
  const soundOnRef = useRef(true)
  const startingRef = useRef(false)

  const leaderId = useMemo(() => {
    const leader = state.horses
      .filter((horse) => !horse.isEliminated)
      .reduce<(typeof state.horses)[number] | null>(
        (best, horse) => (!best || horse.position > best.position ? horse : best),
        null,
      )
    return leader?.id ?? null
  }, [state.horses])

  const audioState = useMemo<RaceAudioState>(
    () => ({
      phase: state.phase,
      raceNumber: state.raceNumber,
      raceProgress: state.raceProgress,
      racePaused: state.racePaused,
      activeEventId,
      leaderId,
      eliminatedCount: state.horses.filter((horse) => horse.isEliminated).length,
      jockeyFallCount: state.horses.filter((horse) => horse.jockeyFallen).length,
      reversedCount: state.horses.filter((horse) => horse.isReversed).length,
      lightningId: state.lightningEvent?.id ?? null,
      lightningPhase: state.lightningEvent?.phase ?? null,
    }),
    [activeEventId, leaderId, state.horses, state.phase, state.raceNumber, state.racePaused, state.raceProgress],
  )
  const latestAudioStateRef = useRef(audioState)
  latestAudioStateRef.current = audioState

  const startAudio = useCallback(() => {
    if (!soundOnRef.current) return
    const existing = audioRef.current
    if (existing) {
      void existing.unlock()
      return
    }
    if (startingRef.current) return

    startingRef.current = true
    const director = new RaceAudioDirector((track) => setTrackTitle(track?.title ?? null))
    audioRef.current = director
    void director
      .start(latestAudioStateRef.current)
      .catch(() => {
        director.stop()
        if (audioRef.current === director) {
          audioRef.current = null
          setTrackTitle(null)
        }
      })
      .finally(() => {
        startingRef.current = false
      })
  }, [])

  const toggleSound = useCallback(() => {
    if (soundOnRef.current) {
      soundOnRef.current = false
      startingRef.current = false
      audioRef.current?.stop()
      audioRef.current = null
      setTrackTitle(null)
      setSoundOn(false)
      return
    }

    soundOnRef.current = true
    setSoundOn(true)
    startAudio()
  }, [startAudio])

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await document.documentElement.requestFullscreen()
  }, [])

  useEffect(() => {
    const sync = () => setFullscreen(!!document.fullscreenElement)
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (key === 'f' && !event.altKey) {
        event.preventDefault()
        void toggleFullscreen()
      }
    }
    document.addEventListener('fullscreenchange', sync)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      window.removeEventListener('keydown', onKey)
    }
  }, [toggleFullscreen])

  useEffect(() => {
    startAudio()
    const unlock = () => {
      if (!soundOnRef.current) return
      if (audioRef.current) void audioRef.current.unlock()
      else startAudio()
    }
    window.addEventListener('pointerdown', unlock, true)
    window.addEventListener('keydown', unlock, true)
    return () => {
      window.removeEventListener('pointerdown', unlock, true)
      window.removeEventListener('keydown', unlock, true)
    }
  }, [startAudio])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'm' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      event.preventDefault()
      toggleSound()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleSound])

  useEffect(() => {
    if (soundOn) audioRef.current?.update(audioState)
  }, [audioState, soundOn])

  useEffect(
    () => () => {
      audioRef.current?.stop()
      audioRef.current = null
    },
    [],
  )

  return (
    <div className="absolute bottom-[6.5vh] right-5 z-50 flex gap-2">
      <button
        type="button"
        onClick={toggleSound}
        aria-pressed={soundOn}
        title="Musique : touche M"
        className="rounded-lg border border-derby-gold/60 bg-derby-night/85 px-3 py-2 font-headline text-sm tracking-[0.14em] text-derby-cream backdrop-blur-sm"
      >
        {soundOn ? `🔊 ${trackTitle ?? 'AMBIANCE ON'} · M` : '🔇 SON OFF · M'}
      </button>
      <button
        type="button"
        onClick={() => void toggleFullscreen()}
        className="rounded-lg border border-derby-gold/60 bg-derby-night/85 px-3 py-2 font-headline text-sm tracking-[0.14em] text-derby-cream backdrop-blur-sm"
      >
        {fullscreen ? '↙ QUITTER' : '⛶ PLEIN ÉCRAN'}
      </button>
    </div>
  )
}
