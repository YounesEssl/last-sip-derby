import { Injectable, OnModuleInit } from '@nestjs/common'
import { v4 as uuid } from 'uuid'
import {
  GameState,
  GamePhase,
  Horse,
  Player,
  Bet,
  GameEvent,
  horsesData,
  HORSES_PER_RACE,
  HORSE_COLORS,
  MAX_ACTIVE_PLAYERS,
  BASE_SPEED,
  DRINK_CONFIRM_TIMEOUT_MS,
  DRINK_PENALTY_SIPS,
  PHASE_DURATIONS,
} from '@last-sip-derby/shared'
import { PersistenceService } from '../persistence/persistence.service'

@Injectable()
export class GameService implements OnModuleInit {
  private state: GameState = {
    phase: 'IDLE',
    raceNumber: 0,
    horses: [],
    players: [],
    queue: [],
    activeEvent: null,
    phaseStartedAt: Date.now(),
    phaseDuration: PHASE_DURATIONS.IDLE,
    lastRaceWinner: null,
  }

  private playersByPseudo: Map<string, Player> = new Map()
  private socketToPlayer: Map<string, string> = new Map() // socketId -> pseudo
  private drinkTimers: Map<string, NodeJS.Timeout> = new Map()

  constructor(private persistence: PersistenceService) {}

  async onModuleInit() {
    const restored = await this.persistence.tryRestore()
    if (restored) {
      for (const p of restored.players) {
        const player: Player = {
          ...p,
          id: '',
          isConnected: false,
          currentBet: null,
          lastSeen: Date.now(),
        }
        this.playersByPseudo.set(p.pseudo, player)
      }
      this.state.raceNumber = restored.raceNumber
      console.log(`Restored ${restored.players.length} players, race #${restored.raceNumber}`)
    }
  }

  getState(): GameState {
    this.state.players = this.getConnectedPlayers()
    return { ...this.state }
  }

  getPhase(): GamePhase {
    return this.state.phase
  }

  getRaceNumber(): number {
    return this.state.raceNumber
  }

  getHorses(): Horse[] {
    return this.state.horses
  }

  getConnectedPlayers(): Player[] {
    return Array.from(this.playersByPseudo.values()).filter((p) => p.isConnected)
  }

  getAllPlayers(): Player[] {
    return Array.from(this.playersByPseudo.values())
  }

  getPlayerBySocket(socketId: string): Player | undefined {
    const pseudo = this.socketToPlayer.get(socketId)
    if (!pseudo) return undefined
    return this.playersByPseudo.get(pseudo)
  }

  getPlayerByPseudo(pseudo: string): Player | undefined {
    return this.playersByPseudo.get(pseudo)
  }

  hasConnectedPlayers(): boolean {
    return Array.from(this.playersByPseudo.values()).some((p) => p.isConnected)
  }

  // Player management
  joinPlayer(socketId: string, pseudo: string): Player {
    const existing = this.playersByPseudo.get(pseudo)
    if (existing) {
      // Reconnection
      existing.id = socketId
      existing.isConnected = true
      existing.lastSeen = Date.now()
      this.socketToPlayer.set(socketId, pseudo)
      return existing
    }

    const player: Player = {
      id: socketId,
      pseudo,
      isConnected: true,
      currentBet: null,
      totalSipsGiven: 0,
      totalSipsDrunk: 0,
      debt: 0,
      lastSeen: Date.now(),
    }

    this.playersByPseudo.set(pseudo, player)
    this.socketToPlayer.set(socketId, pseudo)

    // Add to queue or active depending on phase and count
    const active = this.getConnectedPlayers()
    if (active.length > MAX_ACTIVE_PLAYERS) {
      this.state.queue.push(pseudo)
    }

    return player
  }

  disconnectPlayer(socketId: string): Player | undefined {
    const pseudo = this.socketToPlayer.get(socketId)
    if (!pseudo) return undefined

    const player = this.playersByPseudo.get(pseudo)
    if (player) {
      player.isConnected = false
      player.lastSeen = Date.now()
    }

    this.socketToPlayer.delete(socketId)
    return player
  }

  // Betting
  placeBet(socketId: string, horseId: string, amount: number): Bet | null {
    if (this.state.phase !== 'BETTING') return null

    const player = this.getPlayerBySocket(socketId)
    if (!player) return null

    const horse = this.state.horses.find((h) => h.id === horseId)
    if (!horse) return null

    const clampedAmount = Math.max(1, Math.min(5, Math.round(amount)))

    const bet: Bet = {
      playerId: player.id,
      horseId,
      amount: clampedAmount,
    }

    player.currentBet = bet
    return bet
  }

  // Phase transitions
  startBetting(): void {
    this.state.raceNumber++
    this.state.phase = 'BETTING'
    this.state.phaseStartedAt = Date.now()
    this.state.phaseDuration = PHASE_DURATIONS.BETTING
    this.state.activeEvent = null
    this.state.lastRaceWinner = null

    // Pick 6 random horses
    const shuffled = [...horsesData].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, HORSES_PER_RACE)

    this.state.horses = selected.map((h, i) => {
      const totalStats = h.speed + h.endurance
      const odds = parseFloat((10 / totalStats * 2).toFixed(1))
      return {
        id: uuid(),
        name: h.name,
        speed: h.speed,
        endurance: h.endurance,
        odds,
        position: 0,
        lane: i,
        isStunned: false,
        color: HORSE_COLORS[i],
      }
    })

    // Clear bets
    for (const player of this.playersByPseudo.values()) {
      player.currentBet = null
    }

    // Move queue players to active
    this.promoteFromQueue()
  }

  startRacing(): void {
    this.state.phase = 'RACING'
    this.state.phaseStartedAt = Date.now()
    this.state.phaseDuration = PHASE_DURATIONS.RACING
  }

  tickRace(): Horse | null {
    const raceProgress = (Date.now() - this.state.phaseStartedAt) / this.state.phaseDuration
    let winner: Horse | null = null

    for (const horse of this.state.horses) {
      if (horse.isStunned) continue
      if (horse.position >= 100) continue

      const speedFactor = horse.speed / 10
      const enduranceFactor = this.calculateEndurance(horse, raceProgress)
      const randomFactor = 0.7 + Math.random() * 0.6

      const increment = BASE_SPEED * speedFactor * enduranceFactor * randomFactor
      horse.position = Math.min(100, horse.position + increment)

      if (horse.position >= 100 && !winner) {
        winner = horse
      }
    }

    return winner
  }

  private calculateEndurance(horse: Horse, raceProgress: number): number {
    // Low endurance horses slow down significantly in the second half
    if (raceProgress < 0.5) return 1.0
    const enduranceFactor = horse.endurance / 10
    const fatigue = (raceProgress - 0.5) * 2 // 0 to 1 in second half
    return enduranceFactor + (1 - enduranceFactor) * (1 - fatigue * 0.6)
  }

  startResults(winnerHorse: Horse): { winnerId: string; sipsToDistribute: number; losers: Array<{ player: Player; sips: number }> } {
    this.state.phase = 'RESULTS'
    this.state.phaseStartedAt = Date.now()
    this.state.phaseDuration = PHASE_DURATIONS.RESULTS

    const losers: Array<{ player: Player; sips: number }> = []
    let winnerPlayer: Player | undefined
    let sipsToDistribute = 0

    for (const player of this.playersByPseudo.values()) {
      if (!player.currentBet) continue

      if (player.currentBet.horseId === winnerHorse.id) {
        // Winner: gets to distribute sips
        sipsToDistribute = Math.round(player.currentBet.amount * winnerHorse.odds)
        player.totalSipsGiven += sipsToDistribute
        winnerPlayer = player
      } else {
        // Loser: drinks their bet amount
        const sips = player.currentBet.amount
        player.debt += sips
        player.totalSipsDrunk += sips
        losers.push({ player, sips })
      }
    }

    if (winnerPlayer) {
      this.state.lastRaceWinner = {
        pseudo: winnerPlayer.pseudo,
        horseName: winnerHorse.name,
        sipsToDistribute,
      }
    }

    return { winnerId: winnerHorse.id, sipsToDistribute, losers }
  }

  startIdle(): void {
    this.state.phase = 'IDLE'
    this.state.phaseStartedAt = Date.now()
    this.state.phaseDuration = PHASE_DURATIONS.IDLE
    this.state.activeEvent = null
  }

  // Events
  setActiveEvent(event: GameEvent): void {
    this.state.activeEvent = event
  }

  clearActiveEvent(): void {
    this.state.activeEvent = null
  }

  stunHorse(horseId: string, durationMs: number): void {
    const horse = this.state.horses.find((h) => h.id === horseId)
    if (horse) {
      horse.isStunned = true
      setTimeout(() => {
        horse.isStunned = false
      }, durationMs)
    }
  }

  boostHorse(horseId: string): void {
    const horse = this.state.horses.find((h) => h.id === horseId)
    if (horse) {
      horse.position = Math.min(100, horse.position + 0.5)
    }
  }

  // Drink management
  confirmDrink(socketId: string): number {
    const player = this.getPlayerBySocket(socketId)
    if (!player || player.debt <= 0) return 0

    const confirmed = player.debt
    player.debt = 0

    const timerKey = player.pseudo
    const timer = this.drinkTimers.get(timerKey)
    if (timer) {
      clearTimeout(timer)
      this.drinkTimers.delete(timerKey)
    }

    return confirmed
  }

  startDrinkTimer(pseudo: string, onPenalty: () => void): void {
    const existing = this.drinkTimers.get(pseudo)
    if (existing) clearTimeout(existing)

    const timer = setTimeout(() => {
      const player = this.playersByPseudo.get(pseudo)
      if (player && player.debt > 0) {
        player.debt += DRINK_PENALTY_SIPS
        onPenalty()
      }
      this.drinkTimers.delete(pseudo)
    }, DRINK_CONFIRM_TIMEOUT_MS)

    this.drinkTimers.set(pseudo, timer)
  }

  // Queue management
  private promoteFromQueue(): void {
    const active = this.getConnectedPlayers()
    while (this.state.queue.length > 0 && active.length < MAX_ACTIVE_PLAYERS) {
      const pseudo = this.state.queue.shift()
      if (pseudo) {
        const player = this.playersByPseudo.get(pseudo)
        if (player && player.isConnected) {
          active.push(player)
        }
      }
    }
  }

  // Persistence
  getDumpData() {
    return {
      players: Array.from(this.playersByPseudo.values()).map((p) => ({
        pseudo: p.pseudo,
        totalSipsGiven: p.totalSipsGiven,
        totalSipsDrunk: p.totalSipsDrunk,
        debt: p.debt,
      })),
      raceNumber: this.state.raceNumber,
      dumpedAt: Date.now(),
    }
  }
}
