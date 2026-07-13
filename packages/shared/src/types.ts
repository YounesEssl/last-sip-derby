export type GamePhase = 'BETTING' | 'RACING' | 'RESULTS' | 'IDLE'

export type HorseAppearance = 'HORSE' | 'CAMEL' | 'MOTORCYCLE'

export type RaceIncidentVisual = 'NONE' | 'DRUNK_SPECTATOR' | 'TURKEY'

export interface LightningEvent {
  id: string
  startedAt: number
  strikeAt: number
  clearAt: number
  endsAt: number
  targetHorseIds: string[]
  phase: 'BLACKOUT' | 'STRIKE' | 'CLEARING'
}

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
  appearance: HorseAppearance
  isGolden: boolean
  jockeyFallen: boolean
  isReversed: boolean
  isStruckByLightning: boolean
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
  visualKind: RaceIncidentVisual
}

export interface GameState {
  serverNow: number
  phase: GamePhase
  raceNumber: number
  horses: Horse[]
  players: Player[]
  eveningLeaderboard: Player[]
  roundDrinks: SipAllocation[]
  queue: string[]
  activeEvent: GameEvent | null
  lightningEvent: LightningEvent | null
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

export interface SipAllocation {
  pseudo: string
  sips: number
}

export interface ClientToServerEvents {
  'player:join': (pseudo: string) => void
  'player:bet': (bet: { horseId: string; amount: number }) => void
  'player:confirmDrink': () => void
  'player:vote': (data: { eventId: string; valid: boolean }) => void
  'player:snitch': (data: { targetPseudo: string }) => void
  'winner:distributeSips': (allocations: SipAllocation[]) => void
  'dev:startRace': () => void
  'dev:resetRace': () => void
}

export interface ServerToClientEvents {
  'game:stateUpdate': (state: GameState) => void
  'game:event': (event: GameEvent) => void
  'game:eventResolved': (data: { eventId: string; horseEliminated: boolean; horseName: string }) => void
  'game:phaseChange': (phase: GamePhase) => void
  'player:joined': (player: Player) => void
  'player:drinkNotification': (data: { sips: number; reason: string; deadline?: number }) => void
}
