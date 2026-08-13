'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GameState } from '@last-sip-derby/shared'
import { RaceAudioDirector, type RaceAudioState } from '@/audio/raceAudio'

export function ExperienceControls({ state, activeEventId, showReset, onResetSession, onRulesOpen }: { state: GameState; activeEventId: string | null; showReset: boolean; onResetSession: () => void; onRulesOpen: () => void }) {
  const [soundOn, setSoundOn] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [trackTitle, setTrackTitle] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
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
      gamePaused: state.isGamePaused,
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
    [activeEventId, leaderId, state.horses, state.isGamePaused, state.phase, state.raceNumber, state.racePaused, state.raceProgress],
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

  useEffect(() => {
    if (!showReset) setConfirmReset(false)
  }, [showReset])

  useEffect(
    () => () => {
      audioRef.current?.stop()
      audioRef.current = null
    },
    [],
  )

  return (
    <div className="absolute bottom-1 right-1 z-[120] flex gap-1 opacity-25 transition-opacity duration-200 hover:opacity-90 focus-within:opacity-90">
      <button
        type="button"
        data-testid="open-rulebook"
        onClick={onRulesOpen}
        disabled={state.isRulesOpen}
        aria-haspopup="dialog"
        aria-label="Ouvrir les règles du jeu et mettre la partie en pause"
        title="Règles du jeu"
        className="h-7 rounded border border-derby-gold/45 bg-derby-night/45 px-2 font-headline text-[9px] tracking-[0.08em] text-derby-cream backdrop-blur-[1px] disabled:opacity-50"
      >
        RÈGLES DU JEU
      </button>
      <button
        type="button"
        onClick={toggleSound}
        aria-pressed={soundOn}
        aria-label={soundOn ? 'Couper l’ambiance sonore' : 'Activer l’ambiance sonore'}
        title={`${soundOn ? trackTitle ?? 'Ambiance activée' : 'Ambiance coupée'} · touche M`}
        className="h-7 rounded border border-derby-gold/45 bg-derby-night/45 px-2 font-headline text-[9px] tracking-[0.08em] text-derby-cream backdrop-blur-[1px]"
      >
        {soundOn ? '🔊 M' : '🔇 M'}
      </button>
      {showReset && (
        <button
          type="button"
          aria-label={confirmReset ? 'Confirmer le reset de la soirée' : 'Reset de la soirée'}
          title={confirmReset ? 'Cliquer à nouveau pour confirmer' : 'Reset soirée'}
          onClick={() => {
            if (confirmReset) {
              onResetSession()
              setConfirmReset(false)
            } else {
              setConfirmReset(true)
              setTimeout(() => setConfirmReset(false), 4_000)
            }
          }}
          className={`h-7 rounded border px-2 font-headline text-[9px] tracking-[0.08em] backdrop-blur-[1px] ${confirmReset ? 'border-red-500 bg-red-800/85 text-white' : 'border-derby-gold/45 bg-derby-night/45 text-derby-cream'}`}
        >
          {confirmReset ? 'CONFIRMER' : '↻ RESET'}
        </button>
      )}
      <button
        type="button"
        onClick={() => void toggleFullscreen()}
        aria-label={fullscreen ? 'Quitter le plein écran' : 'Passer en plein écran'}
        title={`${fullscreen ? 'Quitter le plein écran' : 'Plein écran'} · touche F`}
        className="h-7 rounded border border-derby-gold/45 bg-derby-night/45 px-2 font-headline text-[9px] tracking-[0.08em] text-derby-cream backdrop-blur-[1px]"
      >
        {fullscreen ? '↙ F' : '⛶ F'}
      </button>
    </div>
  )
}
