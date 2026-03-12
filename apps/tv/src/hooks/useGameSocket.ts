'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import type { GameState, GameEvent, GamePhase, ServerToClientEvents, ClientToServerEvents } from '@last-sip-derby/shared'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3001'

export function useGameSocket() {
  const socketRef = useRef<TypedSocket | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [activeEvent, setActiveEvent] = useState<GameEvent | null>(null)
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
    })

    socket.on('game:event', (event: GameEvent) => {
      setActiveEvent(event)
      // Auto-clear after expiry
      const expiresIn = event.expiresAt - Date.now()
      if (expiresIn > 0) {
        setTimeout(() => setActiveEvent(null), expiresIn)
      }
    })

    socket.on('game:phaseChange', () => {
      setActiveEvent(null)
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

  return { gameState, activeEvent, connected, startRace, resetRace }
}
