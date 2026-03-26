'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import type { GameState, GameEvent, ServerToClientEvents, ClientToServerEvents } from '@last-sip-derby/shared'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

function getServerUrl() {
  if (process.env.NEXT_PUBLIC_SERVER_URL) return process.env.NEXT_PUBLIC_SERVER_URL
  if (typeof window === 'undefined') return 'http://localhost:3001'
  // In production (nginx), socket.io is proxied on same host. In dev, use port 3001.
  const isDev = window.location.port === '3000' || window.location.port === '3001'
  return isDev
    ? `${window.location.protocol}//${window.location.hostname}:3001`
    : `${window.location.protocol}//${window.location.host}`
}
const SERVER_URL = getServerUrl()

export function useGameSocket() {
  const socketRef = useRef<TypedSocket | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [activeEvent, setActiveEvent] = useState<GameEvent | null>(null)
  const [eventResolution, setEventResolution] = useState<{ horseEliminated: boolean; horseName: string } | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const socket: TypedSocket = io(SERVER_URL, {
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    })

    socketRef.current = socket

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))

    socket.on('game:stateUpdate', (state: GameState) => {
      setGameState(state)
      // Keep activeEvent in sync with state
      if (state.activeEvent) {
        setActiveEvent(state.activeEvent)
      } else {
        setActiveEvent(null)
        setEventResolution(null)
      }
    })

    socket.on('game:event', (event: GameEvent) => {
      setActiveEvent(event)
      setEventResolution(null)
    })

    socket.on('game:eventResolved', (data) => {
      setEventResolution({ horseEliminated: data.horseEliminated, horseName: data.horseName })
    })

    socket.on('game:phaseChange', () => {
      setActiveEvent(null)
      setEventResolution(null)
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  const startRace = useCallback(() => {
    socketRef.current?.emit('dev:startRace')
  }, [])

  const resetRace = useCallback(() => {
    socketRef.current?.emit('dev:resetRace')
  }, [])

  return { gameState, activeEvent, eventResolution, connected, startRace, resetRace }
}
