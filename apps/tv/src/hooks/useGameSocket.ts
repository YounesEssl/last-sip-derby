'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import type { GameState, GameEvent, ServerToClientEvents, ClientToServerEvents } from '@last-sip-derby/shared'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL
  ?? (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001')

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
