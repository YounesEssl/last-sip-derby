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

// Internal per-horse state — simple phase system for dramatic races
type HorsePhase = 'stall' | 'fade' | 'cruise' | 'burst' | 'sprint'
interface HorseRaceState {
  phase: HorsePhase
  phaseTicksLeft: number
  style: 'frontrunner' | 'steady' | 'closer'
}

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

  // Race simulation state (reset each race)
  private horseRaceStates: Map<string, HorseRaceState> = new Map()
  private raceTick = 0

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
      // Base odds from stats + random "form of the day" variance (±40%)
      const formFactor = 0.6 + Math.random() * 0.8 // 0.6 – 1.4
      const rawOdds = (10 / totalStats * 2) * formFactor
      const odds = parseFloat(Math.max(1.1, rawOdds).toFixed(1))
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
        effectiveSpeed: 0,
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

    // Reset positions and initialize per-horse race simulation state
    this.raceTick = 0
    this.horseRaceStates.clear()
    const styles: Array<'frontrunner' | 'steady' | 'closer'> = ['frontrunner', 'steady', 'closer', 'frontrunner', 'steady', 'closer']
    const shuffledStyles = styles.sort(() => Math.random() - 0.5)
    for (let i = 0; i < this.state.horses.length; i++) {
      const horse = this.state.horses[i]
      horse.position = 0
      horse.effectiveSpeed = 0
      this.horseRaceStates.set(horse.id, {
        phase: 'cruise',
        phaseTicksLeft: 10 + Math.floor(Math.random() * 20),
        style: shuffledStyles[i % shuffledStyles.length],
      })
    }
  }

  tickRace(): Horse | null {
    this.raceTick++
    const raceProgress = (Date.now() - this.state.phaseStartedAt) / this.state.phaseDuration
    let winner: Horse | null = null

    // Phase speed multipliers — huge differences
    const PHASE_SPEED: Record<HorsePhase, number> = {
      stall:  0.02,  // nearly stopped
      fade:   0.3,   // visibly slow
      cruise: 1.0,   // normal
      burst:  2.2,   // fast overtake
      sprint: 3.5,   // explosive
    }

    // Rank horses by position for position-based phase bias
    const sorted = [...this.state.horses].sort((a, b) => b.position - a.position)
    const rankMap = new Map<string, number>()
    sorted.forEach((h, i) => rankMap.set(h.id, i))
    const horseCount = this.state.horses.length

    for (const horse of this.state.horses) {
      if (horse.isStunned) continue
      if (horse.position >= 100) continue

      const rs = this.horseRaceStates.get(horse.id)
      if (!rs) continue

      const rank = rankMap.get(horse.id) ?? 0 // 0 = first, 5 = last
      const rankNorm = rank / (horseCount - 1) // 0 = leader, 1 = last

      // ── Phase transitions ──
      rs.phaseTicksLeft--
      if (rs.phaseTicksLeft <= 0) {
        rs.phase = this.pickNextPhase(rs, raceProgress, rankNorm)
        rs.phaseTicksLeft = this.pickPhaseDuration(rs.phase)
      }

      // ── Style modifier ──
      let styleMult = 1.0
      if (rs.style === 'frontrunner') {
        styleMult = raceProgress < 0.4 ? 1.5 : raceProgress < 0.7 ? 1.0 : 0.6
      } else if (rs.style === 'closer') {
        styleMult = raceProgress < 0.4 ? 0.55 : raceProgress < 0.7 ? 1.0 : 1.7
      }

      // ── Stats bonus: better horses (lower odds) get a small edge ──
      // speed+endurance ranges ~2-20, normalize to 0.85–1.15
      const totalStats = horse.speed + horse.endurance
      const statsMult = 0.85 + (totalStats / 20) * 0.30

      const phaseMult = PHASE_SPEED[rs.phase]
      const noise = 0.85 + Math.random() * 0.3

      const increment = BASE_SPEED * phaseMult * styleMult * statsMult * noise
      horse.effectiveSpeed = Math.max(1, Math.min(10, increment * 10))
      horse.position = Math.min(100, horse.position + increment)

      if (horse.position >= 100 && !winner) {
        winner = horse
      }
    }

    return winner
  }

  private pickNextPhase(rs: HorseRaceState, raceProgress: number, rankNorm: number): HorsePhase {
    // rankNorm: 0 = leader, 1 = last place
    // Leaders get more stall/fade, last place gets more burst/sprint
    const roll = Math.random()
    const isSprint = raceProgress > 0.8

    // Bias: leaders stall more, trailers burst more
    const stallChance  = 0.06 + rankNorm * -0.04 + (1 - rankNorm) * 0.08  // leader ~0.14, last ~0.02
    const fadeChance   = 0.12 + (1 - rankNorm) * 0.12                      // leader ~0.24, last ~0.12
    const cruiseChance = 0.25                                                // same for all
    const burstChance  = 0.20 + rankNorm * 0.15                             // leader ~0.20, last ~0.35
    // sprint = remainder                                                    // leader ~0.17, last ~0.26

    if (isSprint) {
      // Final stretch: amplify everything, more chaos
      if (roll < stallChance * 0.8) return 'stall'
      if (roll < stallChance * 0.8 + fadeChance * 0.5) return 'fade'
      if (roll < stallChance * 0.8 + fadeChance * 0.5 + 0.15) return 'cruise'
      if (roll < stallChance * 0.8 + fadeChance * 0.5 + 0.15 + burstChance * 1.2) return 'burst'
      return 'sprint'
    }

    let acc = 0
    acc += stallChance;  if (roll < acc) return 'stall'
    acc += fadeChance;   if (roll < acc) return 'fade'
    acc += cruiseChance; if (roll < acc) return 'cruise'
    acc += burstChance;  if (roll < acc) return 'burst'
    return 'sprint'
  }

  private pickPhaseDuration(phase: HorsePhase): number {
    // Duration in ticks (100ms each)
    switch (phase) {
      case 'stall':  return 15 + Math.floor(Math.random() * 25)  // 1.5–4s
      case 'fade':   return 20 + Math.floor(Math.random() * 30)  // 2–5s
      case 'cruise': return 15 + Math.floor(Math.random() * 25)  // 1.5–4s
      case 'burst':  return 20 + Math.floor(Math.random() * 35)  // 2–5.5s
      case 'sprint': return 10 + Math.floor(Math.random() * 20)  // 1–3s
    }
  }
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
