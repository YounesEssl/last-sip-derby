'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import type {
  GameState,
  Player,
  GameEvent,
  ServerToClientEvents,
  ClientToServerEvents,
} from '@last-sip-derby/shared'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3001'

export function usePlayerSocket() {
  const socketRef = useRef<TypedSocket | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [connected, setConnected] = useState(false)
  const [drinkNotification, setDrinkNotification] = useState<{ sips: number; reason: string } | null>(null)
  const [boostWindow, setBoostWindow] = useState<{ horseId: string; durationMs: number } | null>(null)
  const [pseudo, setPseudo] = useState<string | null>(null)

  useEffect(() => {
    const socket: TypedSocket = io(SERVER_URL, {
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      // Rejoin if we had a pseudo
      const savedPseudo = pseudo ?? sessionStorage.getItem('derby_pseudo')
      if (savedPseudo) {
        socket.emit('player:join', savedPseudo)
      }
    })

    socket.on('disconnect', () => setConnected(false))

    socket.on('game:stateUpdate', (state: GameState) => {
      setGameState(state)
      // Update local player state
      if (pseudo) {
        const me = state.players.find((p) => p.pseudo === pseudo)
        if (me) setPlayer(me)
      }
    })

    socket.on('player:joined', (p: Player) => {
      setPlayer(p)
    })

    socket.on('player:drinkNotification', (data) => {
      setDrinkNotification(data)
      // Vibrate
      if (navigator.vibrate) navigator.vibrate([200, 100, 200])
    })

    socket.on('player:boostWindow', (data) => {
      setBoostWindow(data)
      if (navigator.vibrate) navigator.vibrate(100)
      // Auto-clear after duration
      setTimeout(() => setBoostWindow(null), data.durationMs)
    })

    return () => {
      socket.disconnect()
    }
  }, [pseudo])

  const join = useCallback((name: string) => {
    setPseudo(name)
    sessionStorage.setItem('derby_pseudo', name)
    socketRef.current?.emit('player:join', name)
  }, [])

  const placeBet = useCallback((bet: { horseId: string; amount: number }) => {
    socketRef.current?.emit('player:bet', bet)
  }, [])

  const confirmDrink = useCallback(() => {
    socketRef.current?.emit('player:confirmDrink')
    setDrinkNotification(null)
  }, [])

  const tapBoost = useCallback((horseId: string) => {
    socketRef.current?.emit('player:tapBoost', { horseId })
    if (navigator.vibrate) navigator.vibrate(30)
  }, [])

  return {
    gameState,
    player,
    connected,
    drinkNotification,
    boostWindow,
    pseudo,
    join,
    placeBet,
    confirmDrink,
    tapBoost,
  }
}
