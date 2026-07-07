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

function getServerUrl() {
  if (process.env.NEXT_PUBLIC_SERVER_URL) return process.env.NEXT_PUBLIC_SERVER_URL
  if (typeof window === 'undefined') return 'http://localhost:3001'
  // In production (nginx), socket.io is proxied on same host. In dev, use port 3001.
  const isDev = window.location.port === '3002' || window.location.port === '3001'
  return isDev
    ? `${window.location.protocol}//${window.location.hostname}:3001`
    : `${window.location.protocol}//${window.location.host}`
}
const SERVER_URL = getServerUrl()

export function usePlayerSocket() {
  const socketRef = useRef<TypedSocket | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [connected, setConnected] = useState(false)
  const [drinkNotification, setDrinkNotification] = useState<{
    sips: number
    reason: string
    deadline?: number
  } | null>(null)
  const [voteRequest, setVoteRequest] = useState<GameEvent | null>(null)
  // Loaded after mount: reading sessionStorage during the first render makes
  // the client HTML diverge from the server HTML (hydration error).
  const [pseudo, setPseudo] = useState<string | null>(null)

  useEffect(() => {
    const saved = sessionStorage.getItem('derby_pseudo')
    if (saved) setPseudo(saved)
  }, [])

  useEffect(() => {
    const socket: TypedSocket = io(SERVER_URL, {
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      const savedPseudo = pseudo ?? sessionStorage.getItem('derby_pseudo')
      if (savedPseudo) {
        socket.emit('player:join', savedPseudo)
      }
    })

    socket.on('disconnect', () => setConnected(false))

    socket.on('game:stateUpdate', (state: GameState) => {
      setGameState(state)
      if (pseudo) {
        const me = state.players.find((p) => p.pseudo === pseudo)
        if (me) {
          setPlayer(me)

          // Clear drink notification if player's horse was eliminated
          if (me.currentBet) {
            const betHorse = state.horses.find((h) => h.id === me.currentBet?.horseId)
            if (betHorse?.isEliminated) {
              setDrinkNotification(null)
            }
          }
        } else {
          setPlayer((prev) => prev ? { ...prev, isConnected: false } : null)
        }
      }
      // Clear vote/drink UI when event is resolved
      if (!state.activeEvent) {
        setVoteRequest(null)
      }
    })

    socket.on('player:joined', (p: Player) => {
      setPlayer(p)
    })

    socket.on('player:drinkNotification', (data) => {
      setDrinkNotification(data)
      if (navigator.vibrate) navigator.vibrate([200, 100, 200])
    })

    socket.on('game:event', (event: GameEvent) => {
      // Check if current player is a voter (non-affected)
      const myId = socketRef.current?.id
      if (myId && event.nonAffectedPlayerIds.includes(myId)) {
        setVoteRequest(event)
      }
    })

    socket.on('game:eventResolved', () => {
      setVoteRequest(null)
      setDrinkNotification(null)
    })

    socket.on('game:phaseChange', () => {
      setVoteRequest(null)
      setDrinkNotification(null)
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

  const vote = useCallback((eventId: string, valid: boolean) => {
    socketRef.current?.emit('player:vote', { eventId, valid })
    setVoteRequest(null)
  }, [])

  const distributeSips = useCallback((allocations: { pseudo: string; sips: number }[]) => {
    socketRef.current?.emit('winner:distributeSips', allocations)
  }, [])

  return {
    gameState,
    player,
    connected,
    drinkNotification,
    voteRequest,
    pseudo,
    join,
    placeBet,
    confirmDrink,
    vote,
    distributeSips,
  }
}
