'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useGameSocket } from '@/hooks/useGameSocket'
import { useSoundEngine } from '@/hooks/useSoundEngine'
import { Screen } from '@/components/tv/Screen'
import { WaitingSaloon } from '@/components/tv/WaitingSaloon'
import { BettingBoard } from '@/components/tv/BettingBoard'
import { DirtTrack } from '@/components/tv/DirtTrack'
import { RaceCountdown } from '@/components/tv/RaceCountdown'
import { RaceResults } from '@/components/tv/RaceResults'

function PhotoFlash({ onComplete }: { onComplete: () => void }) {
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    // Flash lasts 3s: white flash fades, then holds on frozen race for a moment
    const timer = setTimeout(() => onCompleteRef.current(), 3000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        zIndex: 100,
        backgroundColor: '#fff',
        animation: 'photo-flash 2.5s ease-out forwards',
      }}
    />
  )
}

export default function TVPage() {
  const { gameState, activeEvent, eventResolution, connected, startRace } = useGameSocket()
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
        <div className="w-full h-full bg-pmu-paper flex items-center justify-center relative">
          <div className="paper-texture"></div>
          <div className="text-center relative z-10">
            <h1 className="font-rye text-[80px] text-pmu-alert leading-none mb-4" style={{ textShadow: '0 4px 0 rgba(160,32,32,0.3)' }}>
              Last Sip Derby
            </h1>
            <p className="font-terminal text-[28px] text-pmu-dark/40 animate-pulse uppercase">
              Connexion en cours...
            </p>
          </div>
        </div>
      </Screen>
    )
  }

  const phase = freezePhase ? 'BETTING' : gameState.phase
  const showTrack = phase === 'RACING' || phase === 'RESULTS'

  return (
    <Screen>
      {/* DEBUG: instant race button */}
      <button
        onClick={startRace}
        className="absolute top-2 right-2 z-[200] px-3 py-1 bg-pmu-alert text-white font-mono text-xs uppercase opacity-30 hover:opacity-100 transition-opacity"
      >
        GO
      </button>

      {/* IDLE: lobby with QR code + player list */}
      {phase === 'IDLE' && <WaitingSaloon gameState={gameState} />}

      {/* BETTING: betting board with horses, odds, live bets */}
      {phase === 'BETTING' && <BettingBoard gameState={gameState} />}

      {/* RACING / RESULTS: live race */}
      {showTrack && (
        <DirtTrack
          gameState={gameState}
          activeEvent={activeEvent}
          eventResolution={eventResolution}
          raceStarting={raceStarting}
        />
      )}

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

    </Screen>
  )
}
