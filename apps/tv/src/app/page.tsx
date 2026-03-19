'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useGameSocket } from '@/hooks/useGameSocket'
import { useSoundEngine } from '@/hooks/useSoundEngine'
import { Screen } from '@/components/tv/Screen'
import { DirtTrack } from '@/components/tv/DirtTrack'
import { RaceCountdown } from '@/components/tv/RaceCountdown'
import { RaceResults } from '@/components/tv/RaceResults'

function PhotoFlash({ onComplete }: { onComplete: () => void }) {
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    const timer = setTimeout(() => onCompleteRef.current(), 950)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        zIndex: 100,
        backgroundColor: '#fff',
        animation: 'photo-flash 900ms ease-out forwards',
      }}
    />
  )
}

export default function TVPage() {
  const { gameState, activeEvent, connected, startRace, resetRace } = useGameSocket()
  const sound = useSoundEngine()
  const [showCountdown, setShowCountdown] = useState(false)
  const [freezePhase, setFreezePhase] = useState(false)
  const [raceStarting, setRaceStarting] = useState(false)
  const prevPhaseRef = useRef<string | null>(null)
  const sprintWhooshPlayed = useRef(false)

  const [showFlash, setShowFlash] = useState(false)
  const [showResults, setShowResults] = useState(false)

  // Detect phase transitions
  useEffect(() => {
    if (!gameState) return
    const prev = prevPhaseRef.current
    prevPhaseRef.current = gameState.phase

    if (prev !== null && prev !== 'RACING' && gameState.phase === 'RACING') {
      setShowCountdown(true)
      setFreezePhase(true)
      sprintWhooshPlayed.current = false
    }

    // → BETTING: bell
    if (prev !== null && prev !== 'BETTING' && gameState.phase === 'BETTING') {
      sound.playBell()
    }

    // RACING → RESULTS: photo-finish flash + shutter + stop gallop
    if (prev === 'RACING' && gameState.phase === 'RESULTS') {
      setShowFlash(true)
      sound.playShutter()
      sound.stopGallop()
      setTimeout(() => sound.playCheer(), 800)
    }

    // Hide results when leaving RESULTS phase
    if (prev === 'RESULTS' && gameState.phase !== 'RESULTS') {
      setShowResults(false)
    }
  }, [gameState?.phase, sound])

  // Update gallop speeds during race (one track per horse)
  useEffect(() => {
    if (!gameState || gameState.phase !== 'RACING' || freezePhase) return
    const speeds = gameState.horses.map(h => h.effectiveSpeed)
    sound.updateGallopSpeeds(speeds)

    // Sprint whoosh when leader hits 85%
    const leaderPos = Math.max(...gameState.horses.map(h => h.position))
    if (leaderPos > 85 && !sprintWhooshPlayed.current) {
      sprintWhooshPlayed.current = true
      sound.playSprintWhoosh()
    }
  }, [gameState, freezePhase, sound])

  // Event alert sound
  useEffect(() => {
    if (activeEvent) {
      sound.playEventAlert()
    }
  }, [activeEvent, sound])

  // Called when "PARTEZ!" starts fading — unfreeze DirtTrack so horses glide out
  const handleReveal = useCallback(() => {
    setFreezePhase(false)
    setRaceStarting(true)
    sound.startGallop()
  }, [sound])

  // Called when fade is fully done — unmount countdown, clear transition flag
  const handleCountdownComplete = useCallback(() => {
    setShowCountdown(false)
    setTimeout(() => setRaceStarting(false), 800)
  }, [])

  if (!connected || !gameState) {
    return (
      <Screen>
        <div className="text-center">
          <h1 className="font-rye text-[80px] text-western-gold leading-none mb-4" style={{ textShadow: '0 0 30px rgba(212,168,67,0.4)' }}>
            Last Sip Derby
          </h1>
          <p className="font-mono text-[28px] text-western-gold/60 animate-pulse">
            ESTABLISHING CONNECTION...
          </p>
        </div>
      </Screen>
    )
  }

  return (
    <Screen>
      <DirtTrack
        gameState={freezePhase ? { ...gameState, phase: 'BETTING' } : gameState}
        activeEvent={activeEvent}
        raceStarting={raceStarting}
      />

      {/* Race countdown overlay */}
      {showCountdown && (
        <RaceCountdown
          onReveal={handleReveal}
          onComplete={handleCountdownComplete}
          onBeep={sound.playCountdownBeep}
          onStart={sound.playStartGun}
        />
      )}

      {/* Photo-finish flash → triggers results */}
      {showFlash && (
        <PhotoFlash onComplete={() => { setShowFlash(false); setShowResults(true) }} />
      )}

      {/* Results screen */}
      {showResults && gameState.phase === 'RESULTS' && (
        <RaceResults gameState={gameState} onComplete={() => setShowResults(false)} />
      )}

      {/* Dev controls */}
      <div className="absolute bottom-12 right-6 z-50 flex gap-3">
        <button
          onClick={resetRace}
          className="px-5 py-2 bg-white/10 text-white font-mono text-sm border border-white/20 hover:bg-white/20 transition-colors rounded"
        >
          RESET
        </button>
        <button
          onClick={startRace}
          className="px-5 py-2 bg-green-700/80 text-white font-mono text-sm border border-green-400/40 hover:bg-green-600/80 transition-colors rounded"
        >
          START RACE
        </button>
      </div>
    </Screen>
  )
}
