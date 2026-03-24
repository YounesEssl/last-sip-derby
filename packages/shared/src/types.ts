export type GamePhase = 'BETTING' | 'RACING' | 'RESULTS' | 'IDLE'

export interface Horse {
  id: string
  name: string
  speed: number
  endurance: number
  odds: number
  position: number
  lane: number
  isEliminated: boolean
  color: string
  effectiveSpeed: number
}

export interface Bet {
  playerId: string
  horseId: string
  amount: number
}

export interface Player {
  id: string
  pseudo: string
  isConnected: boolean
  currentBet: Bet | null
  totalSipsGiven: number
  totalSipsDrunk: number
  debt: number
  lastSeen: number
}

export interface GameEvent {
  id: string
  title: string
  description: string
  targetHorseId: string
  targetHorseName: string
  affectedPlayerIds: string[]
  nonAffectedPlayerIds: string[]
  sipsAmount: number
  votes: Record<string, boolean>
  votingDeadline: number
  resolved: boolean
  horseEliminated: boolean
}

export interface GameState {
  phase: GamePhase
  raceNumber: number
  horses: Horse[]
  players: Player[]
  queue: string[]
  activeEvent: GameEvent | null
  racePaused: boolean
  raceProgress: number
  phaseStartedAt: number
  phaseDuration: number
  lastRaceWinner: {
    pseudo: string
    horseName: string
    sipsToDistribute: number
  } | null
}

export interface ClientToServerEvents {
  'player:join': (pseudo: string) => void
  'player:bet': (bet: { horseId: string; amount: number }) => void
  'player:confirmDrink': () => void
  'player:vote': (data: { eventId: string; valid: boolean }) => void
  'player:snitch': (data: { targetPseudo: string }) => void
  'dev:startRace': () => void
  'dev:resetRace': () => void
}

export interface ServerToClientEvents {
  'game:stateUpdate': (state: GameState) => void
  'game:event': (event: GameEvent) => void
  'game:eventResolved': (data: { eventId: string; horseEliminated: boolean; horseName: string }) => void
  'game:phaseChange': (phase: GamePhase) => void
  'player:joined': (player: Player) => void
  'player:drinkNotification': (data: { sips: number; reason: string }) => void
}
