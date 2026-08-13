import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import {
  GameEvent,
  RACE_TICK_MS,
  EVENT_EARLIEST_TICK,
  EVENT_LATEST_TICK,
  EVENT_MIN_TICK_GAP,
  EVENT_VOTE_TIMEOUT_MS,
  EVENT_RESOLVE_DISPLAY_MS,
  RACE_EVENT_ODDS,
} from '@last-sip-derby/shared'
import { GameService } from './game.service'
import { GameEvents } from './game.events'

type TimerKey =
  | 'LOBBY'
  | 'PHASE'
  | 'VOTE'
  | 'EVENT_RESULT'
  | 'MINI_GAME'
  | 'MINI_GAME_RESULT'
  | 'EXECUTION'
  | 'LIGHTNING_STRIKE'
  | 'LIGHTNING_CLEAR'
  | 'LIGHTNING_END'

interface PausableTimer {
  timeout: NodeJS.Timeout | null
  dueAt: number
  remainingMs: number
  callback: () => void
}

@Injectable()
export class GameLoop implements OnModuleInit, OnModuleDestroy {
  private raceInterval: NodeJS.Timeout | null = null
  private timers = new Map<TimerKey, PausableTimer>()
  private localTick = 0
  private scheduledEventTicks: number[] = []
  private eventsTriggered = 0
  private lightningScheduledTick: number | null = null
  private miniGameScheduledTick: number | null = null
  private bettingDeadline = 0
  private bettingShortened = false

  private onStateUpdate: (() => void) | null = null
  private onPhaseChange: ((phase: string) => void) | null = null
  private onEventTriggered: ((event: GameEvent) => void) | null = null
  private onEventResolved: ((data: { eventId: string; horseEliminated: boolean; horseName: string }) => void) | null = null
  private onRaceFinished: ((winnerId: string) => void) | null = null
  private onPlayersEliminated: ((playerIds: string[], reason: string) => void) | null = null
  private onPlayersKicked: ((playerIds: string[]) => void) | null = null

  constructor(
    private gameService: GameService,
    private gameEvents: GameEvents,
  ) {}

  onModuleInit() {
    this.gameService.startIdle()
  }

  onModuleDestroy() {
    this.clearTimers()
  }

  setCallbacks(callbacks: {
    onStateUpdate: () => void
    onPhaseChange: (phase: string) => void
    onEventTriggered: (event: GameEvent) => void
    onEventResolved: (data: { eventId: string; horseEliminated: boolean; horseName: string }) => void
    onRaceFinished: (winnerId: string) => void
    onPlayersEliminated: (playerIds: string[], reason: string) => void
    onPlayersKicked: (playerIds: string[]) => void
  }) {
    this.onStateUpdate = callbacks.onStateUpdate
    this.onPhaseChange = callbacks.onPhaseChange
    this.onEventTriggered = callbacks.onEventTriggered
    this.onEventResolved = callbacks.onEventResolved
    this.onRaceFinished = callbacks.onRaceFinished
    this.onPlayersEliminated = callbacks.onPlayersEliminated
    this.onPlayersKicked = callbacks.onPlayersKicked
  }

  onPlayerJoined() {
    if (this.gameService.isGamePaused()) return
    if (this.gameService.getPhase() === 'IDLE' && this.gameService.hasConnectedPlayers()) {
      // Start a 20s countdown before transitioning to betting (if not already counting)
      if (!this.hasTimer('LOBBY')) {
        this.gameService.setIdleCountdown(20_000)
        this.onStateUpdate?.()

        this.scheduleTimer('LOBBY', 20_000, () => {
          if (this.gameService.getPhase() === 'IDLE' && this.gameService.hasConnectedPlayers()) {
            this.transitionToBetting()
          }
        })
      }
    }
  }

  forceStartRace() {
    if (this.gameService.isGamePaused()) return
    this.clearTimers()
    this.gameService.startBetting()
    this.onPlayersKicked?.(this.gameService.consumeKickedSocketIds())
    this.gameService.startRacing()
    this.onPhaseChange?.('RACING')
    this.onStateUpdate?.()
    this.beginRaceLoop()
  }

  forceResetRace() {
    if (this.gameService.isGamePaused()) return
    // Proper reset: back to IDLE with the normal lobby flow (the previous
    // version parked the game in BETTING with no scheduled transition).
    this.transitionToIdle()
  }

  onBetPlaced() {
    if (this.gameService.isGamePaused() || this.gameService.getPhase() !== 'BETTING' || this.bettingShortened) return
    const players = this.gameService.getConnectedPlayers()
    if (!players.length || players.some((player) => !player.currentBet)) return
    if (this.bettingDeadline - Date.now() <= 5_000) return
    this.cancelTimer('PHASE')
    this.bettingShortened = true
    this.gameService.setPhaseCountdown(5_000)
    this.bettingDeadline = Date.now() + 5_000
    this.scheduleTimer('PHASE', 5_000, () => this.startRacing())
    this.onStateUpdate?.()
  }

  handleMiniGameAction() {
    if (this.gameService.isGamePaused()) return
    this.onStateUpdate?.()
    if (this.gameService.shouldEndMiniGameEarly()) this.resolveMiniGame()
  }

  handleBlackKnightKill() {
    if (this.gameService.isGamePaused()) return
    this.onStateUpdate?.()
    this.scheduleTimer('EXECUTION', 3_000, () => { this.gameService.clearExecution(); this.onStateUpdate?.() })
  }

  // Called from gateway when a player votes
  handleVote(eventId: string, playerId: string, valid: boolean) {
    if (this.gameService.isGamePaused()) return
    const result = this.gameService.registerVote(eventId, playerId, valid)
    if (!result) return

    // Broadcast updated state (votes are in activeEvent)
    this.onStateUpdate?.()

    if (result.majority) {
      this.resolveEvent(result.majority === 'not_valid')
    }
  }

  pauseForRules(): boolean {
    const pausedAt = Date.now()
    if (!this.gameService.pauseForRules(pausedAt)) return false
    this.pauseTimers(pausedAt)
    this.onStateUpdate?.()
    return true
  }

  resumeFromRules(): boolean {
    const resumedAt = Date.now()
    const duration = this.gameService.resumeFromRules(resumedAt)
    if (duration === null) return false
    if (this.bettingDeadline > 0) this.bettingDeadline += duration
    this.resumeTimers(resumedAt)
    this.onStateUpdate?.()
    if (this.gameService.getPhase() === 'IDLE' && this.gameService.hasConnectedPlayers()) this.onPlayerJoined()
    return true
  }

  private hasTimer(key: TimerKey): boolean {
    return this.timers.has(key)
  }

  private scheduleTimer(key: TimerKey, delayMs: number, callback: () => void): void {
    this.cancelTimer(key)
    const delay = Math.max(0, delayMs)
    const timer: PausableTimer = {
      timeout: null,
      dueAt: Date.now() + delay,
      remainingMs: delay,
      callback,
    }
    this.timers.set(key, timer)
    if (!this.gameService.isGamePaused()) this.armTimer(key, timer, Date.now())
  }

  private armTimer(key: TimerKey, timer: PausableTimer, now: number): void {
    timer.dueAt = now + timer.remainingMs
    timer.timeout = setTimeout(() => {
      if (this.timers.get(key) !== timer) return
      this.timers.delete(key)
      timer.timeout = null
      timer.remainingMs = 0
      timer.callback()
    }, timer.remainingMs)
  }

  private cancelTimer(key: TimerKey): void {
    const timer = this.timers.get(key)
    if (timer?.timeout) clearTimeout(timer.timeout)
    this.timers.delete(key)
  }

  private pauseTimers(pausedAt: number): void {
    for (const timer of this.timers.values()) {
      if (timer.timeout) clearTimeout(timer.timeout)
      timer.timeout = null
      timer.remainingMs = Math.max(0, timer.dueAt - pausedAt)
    }
  }

  private resumeTimers(resumedAt: number): void {
    for (const [key, timer] of this.timers) {
      if (!timer.timeout) this.armTimer(key, timer, resumedAt)
    }
  }

  private clearTimers() {
    if (this.raceInterval) clearInterval(this.raceInterval)
    this.raceInterval = null
    for (const key of [...this.timers.keys()]) this.cancelTimer(key)
    this.lightningScheduledTick = null
    this.miniGameScheduledTick = null
  }

  private transitionToIdle() {
    this.clearTimers()
    this.gameService.startIdle()
    this.onPhaseChange?.('IDLE')
    this.onStateUpdate?.()

    // If players are still connected, auto-start lobby countdown
    if (this.gameService.hasConnectedPlayers()) {
      this.onPlayerJoined()
    }
  }

  private transitionToBetting() {
    this.clearTimers()
    this.gameService.startBetting()
    this.onPlayersKicked?.(this.gameService.consumeKickedSocketIds())
    this.onPhaseChange?.('BETTING')
    this.onStateUpdate?.()

    const duration = this.gameService.getState().phaseDuration
    this.bettingDeadline = Date.now() + duration
    this.bettingShortened = false
    this.scheduleTimer('PHASE', duration, () => {
      this.startRacing()
    })
  }

  private startRacing() {
    this.clearTimers()
    this.gameService.startRacing()
    this.onPhaseChange?.('RACING')
    this.onStateUpdate?.()
    this.beginRaceLoop()
  }

  private beginRaceLoop() {
    this.localTick = 0
    this.eventsTriggered = 0
    this.scheduleEvents()
    this.scheduleLightning()
    this.scheduleMiniGame()

    this.raceInterval = setInterval(() => {
      if (this.gameService.isGamePaused()) return
      // Skip ticks when race is paused (event in progress)
      if (this.gameService.isRacePaused()) {
        return
      }

      this.localTick++
      const winner = this.gameService.tickRace()
      this.onStateUpdate?.()

      if (this.lightningScheduledTick === this.localTick) {
        this.triggerLightning()
      }

      if (this.miniGameScheduledTick === this.localTick) {
        if (!this.gameService.getState().lightningEvent && !this.gameService.getActiveEvent()) this.triggerMiniGame()
        else this.miniGameScheduledTick = Math.min(540, this.localTick + 60)
      }

      if (this.localTick === 210 || this.localTick === 390) {
        const execution = this.gameService.autoBlackKnightKill()
        if (execution) {
          this.onPlayersEliminated?.(execution.affectedPlayerIds, 'Ton cheval a été exécuté par le Cavalier Noir.')
          this.handleBlackKnightKill()
        }
      }

      // Vote incidents never interrupt the lightning sequence: the horses
      // must keep running in the dark until the strike. Delay a colliding
      // incident instead of dropping it from the race.
      if (this.scheduledEventTicks.includes(this.localTick)) {
        if (this.gameService.getState().lightningEvent) {
          this.scheduledEventTicks = this.scheduledEventTicks.map((tick) =>
            tick === this.localTick ? Math.min(560, tick + 80) : tick,
          )
        } else {
          this.triggerEvent()
        }
      }

      if (winner) {
        this.finishRace(winner.id)
      }
    }, RACE_TICK_MS)

    // No wall-clock timeout here: the deterministic race ticks own the finish.
    // A competing timeout used to set the scripted winner directly to 100 at
    // 60 seconds, sometimes firing just before the final tick and producing a
    // visible teleport onto the line.
  }

  private scheduleEvents() {
    // Roll: 10% = 0 events, 50% = 1 event, 40% = 2 events
    const roll = Math.random()
    const numEvents = roll < 0.10 ? 0 : roll < 0.60 ? 1 : 2

    this.scheduledEventTicks = []

    if (numEvents >= 1) {
      const tick1 = EVENT_EARLIEST_TICK + Math.floor(
        Math.random() * (EVENT_LATEST_TICK - EVENT_EARLIEST_TICK),
      )
      this.scheduledEventTicks.push(tick1)

      if (numEvents >= 2) {
        // Second event must be at least EVENT_MIN_TICK_GAP away
        const minTick2 = tick1 + EVENT_MIN_TICK_GAP
        if (minTick2 < EVENT_LATEST_TICK) {
          const tick2 = minTick2 + Math.floor(
            Math.random() * (EVENT_LATEST_TICK - minTick2),
          )
          this.scheduledEventTicks.push(tick2)
        }
      }
    }

    console.log(`📅 Scheduled ${this.scheduledEventTicks.length} events at ticks:`, this.scheduledEventTicks)
  }

  private scheduleLightning() {
    // One global roll per race. The strike is kept away from the gate and the
    // photo finish so its full blackout/flash/clearing sequence can play.
    this.lightningScheduledTick = Math.random() < 1 / RACE_EVENT_ODDS.LIGHTNING
      ? 140 + Math.floor(Math.random() * 260)
      : null
    if (this.lightningScheduledTick) {
      console.log(`⛈️ Lightning scheduled at tick ${this.lightningScheduledTick}`)
    }
  }

  private scheduleMiniGame() {
    this.miniGameScheduledTick = Math.random() < 1 / RACE_EVENT_ODDS.CUTE_CHALLENGE
      ? 100 + Math.floor(Math.random() * 360)
      : null
  }

  private triggerMiniGame() {
    this.miniGameScheduledTick = null
    const game = this.gameService.startMiniGame()
    if (!game) return
    this.onStateUpdate?.()
    this.scheduleTimer('MINI_GAME', Math.max(0, game.endsAt - Date.now()), () => this.resolveMiniGame())
  }

  private resolveMiniGame() {
    if (this.gameService.isGamePaused()) return
    this.cancelTimer('MINI_GAME')
    const losers = this.gameService.resolveMiniGame()
    this.onPlayersEliminated?.(losers, 'Défi mignon perdu')
    this.onStateUpdate?.()
    this.scheduleTimer('MINI_GAME_RESULT', 5_000, () => {
      this.gameService.clearMiniGame()
      this.onStateUpdate?.()
    })
  }

  private triggerLightning() {
    this.lightningScheduledTick = null
    if (!this.gameService.startLightning()) return
    this.onStateUpdate?.()

    this.scheduleTimer('LIGHTNING_STRIKE', 3_500, () => {
      if (this.gameService.getPhase() !== 'RACING') return
      this.gameService.strikeLightning()
      this.onStateUpdate?.()

      this.scheduleTimer('LIGHTNING_CLEAR', 250, () => {
        if (this.gameService.getPhase() !== 'RACING') return
        this.gameService.startLightningClearing()
        this.onStateUpdate?.()
      })

      this.scheduleTimer('LIGHTNING_END', 3_250, () => {
        this.gameService.clearLightning()
        this.onStateUpdate?.()
      })
    })
  }

  private triggerEvent() {
    const event = this.gameEvents.generateEvent()
    if (!event) return // no valid target (no bets or no voters)

    this.eventsTriggered++

    // Pause race
    this.gameService.pauseRace()
    this.gameService.setActiveEvent(event)

    // Notify clients
    this.onEventTriggered?.(event)
    this.onStateUpdate?.()

    // Start vote timeout (30s)
    this.scheduleTimer('VOTE', EVENT_VOTE_TIMEOUT_MS, () => {
      // Timeout: horse is eliminated
      this.resolveEvent(true)
    })

    console.log(`⚡ EVENT triggered: "${event.title}" — ${event.targetHorseName} (${event.sipsAmount}G)`)
  }

  private resolveEvent(horseEliminated: boolean) {
    if (this.gameService.isGamePaused()) return
    this.cancelTimer('VOTE')

    const event = this.gameService.getActiveEvent()
    if (!event || event.resolved) return

    event.resolved = true
    event.horseEliminated = horseEliminated

    if (horseEliminated) {
      this.gameService.eliminateHorse(event.targetHorseId)
    }

    this.onEventResolved?.({
      eventId: event.id,
      horseEliminated,
      horseName: event.targetHorseName,
    })
    this.onStateUpdate?.()

    console.log(`✅ EVENT resolved: ${horseEliminated ? 'ELIMINATED' : 'VALIDATED'} — ${event.targetHorseName}`)

    // Show result for 5s then resume
    this.scheduleTimer('EVENT_RESULT', EVENT_RESOLVE_DISPLAY_MS, () => {
      this.gameService.clearActiveEvent()
      this.gameService.resumeRace()
      console.log('▶️ Race resumed, activeEvent cleared')
      this.onStateUpdate?.()
    })
  }

  private finishRace(winnerHorseId: string) {
    this.clearTimers()
    this.onRaceFinished?.(winnerHorseId)

    const horse = this.gameService.getHorses().find((h) => h.id === winnerHorseId)
    if (horse) {
      this.gameService.startResults(horse)
    }
    this.onPhaseChange?.('RESULTS')
    this.onStateUpdate?.()

    const resultsDuration = this.gameService.getState().phaseDuration
    this.scheduleTimer('PHASE', resultsDuration, () => {
      // Enchaînement sans écran d'accueil : podium → paris.
      if (this.gameService.hasConnectedPlayers()) this.transitionToBetting()
      else this.transitionToIdle()
    })
  }
}
