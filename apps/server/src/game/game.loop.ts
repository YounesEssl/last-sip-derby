import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import {
  GameEvent,
  RACE_TICK_MS,
  EVENT_EARLIEST_TICK,
  EVENT_LATEST_TICK,
  EVENT_MIN_TICK_GAP,
  EVENT_VOTE_TIMEOUT_MS,
  EVENT_RESOLVE_DISPLAY_MS,
} from '@last-sip-derby/shared'
import { GameService } from './game.service'
import { GameEvents } from './game.events'

@Injectable()
export class GameLoop implements OnModuleInit, OnModuleDestroy {
  private raceInterval: NodeJS.Timeout | null = null
  private phaseTimeout: NodeJS.Timeout | null = null
  private voteTimeout: NodeJS.Timeout | null = null
  private resolveDisplayTimeout: NodeJS.Timeout | null = null
  private localTick = 0
  private scheduledEventTicks: number[] = []
  private eventsTriggered = 0
  private lobbyCountdown: NodeJS.Timeout | null = null
  private lightningScheduledTick: number | null = null
  private lightningTimers: NodeJS.Timeout[] = []

  private onStateUpdate: (() => void) | null = null
  private onPhaseChange: ((phase: string) => void) | null = null
  private onEventTriggered: ((event: GameEvent) => void) | null = null
  private onEventResolved: ((data: { eventId: string; horseEliminated: boolean; horseName: string }) => void) | null = null
  private onRaceFinished: ((winnerId: string) => void) | null = null

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
  }) {
    this.onStateUpdate = callbacks.onStateUpdate
    this.onPhaseChange = callbacks.onPhaseChange
    this.onEventTriggered = callbacks.onEventTriggered
    this.onEventResolved = callbacks.onEventResolved
    this.onRaceFinished = callbacks.onRaceFinished
  }

  onPlayerJoined() {
    if (this.gameService.getPhase() === 'IDLE' && this.gameService.hasConnectedPlayers()) {
      // Start a 20s countdown before transitioning to betting (if not already counting)
      if (!this.lobbyCountdown) {
        this.gameService.setIdleCountdown(20_000)
        this.onStateUpdate?.()

        this.lobbyCountdown = setTimeout(() => {
          this.lobbyCountdown = null
          if (this.gameService.getPhase() === 'IDLE' && this.gameService.hasConnectedPlayers()) {
            this.transitionToBetting()
          }
        }, 20_000)
      }
    }
  }

  forceStartRace() {
    this.clearTimers()
    this.gameService.startBetting()
    this.gameService.startRacing()
    this.onPhaseChange?.('RACING')
    this.onStateUpdate?.()
    this.beginRaceLoop()
  }

  forceResetRace() {
    // Proper reset: back to IDLE with the normal lobby flow (the previous
    // version parked the game in BETTING with no scheduled transition).
    this.transitionToIdle()
  }

  // Called from gateway when a player votes
  handleVote(eventId: string, playerId: string, valid: boolean) {
    const result = this.gameService.registerVote(eventId, playerId, valid)
    if (!result) return

    // Broadcast updated state (votes are in activeEvent)
    this.onStateUpdate?.()

    if (result.majority) {
      this.resolveEvent(result.majority === 'not_valid')
    }
  }

  private clearTimers() {
    if (this.raceInterval) clearInterval(this.raceInterval)
    if (this.phaseTimeout) clearTimeout(this.phaseTimeout)
    if (this.voteTimeout) clearTimeout(this.voteTimeout)
    if (this.resolveDisplayTimeout) clearTimeout(this.resolveDisplayTimeout)
    if (this.lobbyCountdown) clearTimeout(this.lobbyCountdown)
    for (const timer of this.lightningTimers) clearTimeout(timer)
    this.raceInterval = null
    this.phaseTimeout = null
    this.voteTimeout = null
    this.resolveDisplayTimeout = null
    this.lobbyCountdown = null
    this.lightningTimers = []
    this.lightningScheduledTick = null
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
    this.onPhaseChange?.('BETTING')
    this.onStateUpdate?.()

    const duration = this.gameService.getState().phaseDuration
    this.phaseTimeout = setTimeout(() => {
      this.startRacing()
    }, duration)
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

    this.raceInterval = setInterval(() => {
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
    this.lightningScheduledTick = Math.random() < 1 / 8
      ? 140 + Math.floor(Math.random() * 260)
      : null
    if (this.lightningScheduledTick) {
      console.log(`⛈️ Lightning scheduled at tick ${this.lightningScheduledTick}`)
    }
  }

  private triggerLightning() {
    this.lightningScheduledTick = null
    if (!this.gameService.startLightning()) return
    this.onStateUpdate?.()

    const strikeTimer = setTimeout(() => {
      if (this.gameService.getPhase() !== 'RACING') return
      this.gameService.strikeLightning()
      this.onStateUpdate?.()

      const clearingTimer = setTimeout(() => {
        if (this.gameService.getPhase() !== 'RACING') return
        this.gameService.startLightningClearing()
        this.onStateUpdate?.()
      }, 250)
      this.lightningTimers.push(clearingTimer)

      const endTimer = setTimeout(() => {
        this.gameService.clearLightning()
        this.onStateUpdate?.()
      }, 3_250)
      this.lightningTimers.push(endTimer)
    }, 3_500)
    this.lightningTimers.push(strikeTimer)
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
    this.voteTimeout = setTimeout(() => {
      // Timeout: horse is eliminated
      this.resolveEvent(true)
    }, EVENT_VOTE_TIMEOUT_MS)

    console.log(`⚡ EVENT triggered: "${event.title}" — ${event.targetHorseName} (${event.sipsAmount}G)`)
  }

  private resolveEvent(horseEliminated: boolean) {
    if (this.voteTimeout) {
      clearTimeout(this.voteTimeout)
      this.voteTimeout = null
    }

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
    this.resolveDisplayTimeout = setTimeout(() => {
      this.gameService.clearActiveEvent()
      this.gameService.resumeRace()
      console.log('▶️ Race resumed, activeEvent cleared')
      this.onStateUpdate?.()
    }, EVENT_RESOLVE_DISPLAY_MS)
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
    this.phaseTimeout = setTimeout(() => {
      // Always go back to IDLE — players must re-join for the next race
      this.transitionToIdle()
    }, resultsDuration)
  }
}
