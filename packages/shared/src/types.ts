export type GamePhase = 'BETTING' | 'RACING' | 'RESULTS' | 'IDLE'

export interface Horse {
  id: string
  name: string
  speed: number
  endurance: number
  odds: number
  position: number
  lane: number
  isStunned: boolean
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

export type GameEventType =
  | 'ANTIDOPING'
  | 'COUP_DE_FOUET'
  | 'CHUTE_COLLECTIVE'
  | 'OBSTACLE_IMPREVU'

export interface GameEvent {
  id: string
  type: GameEventType
  affectedHorseId?: string
  affectedPlayerIds?: string[]
  message: string
  sipsAmount?: number
  expiresAt: number
}

export interface GameState {
  phase: GamePhase
  raceNumber: number
  horses: Horse[]
  players: Player[]
  queue: string[]
  activeEvent: GameEvent | null
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
  'player:tapBoost': (data: { horseId: string }) => void
  'player:snitch': (data: { targetPseudo: string }) => void
  'dev:startRace': () => void
  'dev:resetRace': () => void
}

export interface ServerToClientEvents {
  'game:stateUpdate': (state: GameState) => void
  'game:event': (event: GameEvent) => void
  'game:phaseChange': (phase: GamePhase) => void
  'player:joined': (player: Player) => void
  'player:drinkNotification': (data: { sips: number; reason: string }) => void
  'player:boostWindow': (data: { horseId: string; durationMs: number }) => void
}
