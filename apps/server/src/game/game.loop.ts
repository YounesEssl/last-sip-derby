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
  private phaseTimeRemaining = 0 // for pausing phaseTimeout
  private lobbyCountdown: NodeJS.Timeout | null = null

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
        // Set the IDLE phase duration to 20s so clients can show a countdown
        const state = this.gameService.getState()
        state.phaseStartedAt = Date.now()
        state.phaseDuration = 20_000
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
    this.clearTimers()
    this.gameService.startBetting()
    this.onPhaseChange?.('IDLE')
    this.onStateUpdate?.()
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
    this.raceInterval = null
    this.phaseTimeout = null
    this.voteTimeout = null
    this.resolveDisplayTimeout = null
    this.lobbyCountdown = null
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

    this.raceInterval = setInterval(() => {
      // Skip ticks when race is paused (event in progress)
      if (this.gameService.isRacePaused()) {
        return
      }

      this.localTick++
      const winner = this.gameService.tickRace()
      this.onStateUpdate?.()

      // Check if it's time for a scheduled event
      if (this.scheduledEventTicks.includes(this.localTick)) {
        this.triggerEvent()
      }

      if (winner) {
        this.finishRace(winner.id)
      }
    }, RACE_TICK_MS)

    const maxDuration = this.gameService.getState().phaseDuration
    this.phaseTimeRemaining = maxDuration
    this.phaseTimeout = setTimeout(() => {
      if (this.gameService.getPhase() === 'RACING') {
        const finishOrder = this.gameService.getFinishOrder()
        if (finishOrder.length > 0) {
          const winnerId = finishOrder[0]
          const horse = this.gameService.getHorses().find((h) => h.id === winnerId)
          if (horse) {
            horse.position = 100
            this.finishRace(winnerId)
          }
        }
      }
    }, maxDuration)
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

  private triggerEvent() {
    const event = this.gameEvents.generateEvent()
    if (!event) return // no valid target (no bets or no voters)

    this.eventsTriggered++

    // Pause race
    this.gameService.pauseRace()
    this.gameService.setActiveEvent(event)

    // Pause the phase timeout
    if (this.phaseTimeout) {
      clearTimeout(this.phaseTimeout)
      this.phaseTimeout = null
    }

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

      // Resume phase timeout with remaining time
      this.phaseTimeout = setTimeout(() => {
        if (this.gameService.getPhase() === 'RACING') {
          const finishOrder = this.gameService.getFinishOrder()
          if (finishOrder.length > 0) {
            const winnerId = finishOrder[0]
            const horse = this.gameService.getHorses().find((h) => h.id === winnerId)
            if (horse) {
              horse.position = 100
              this.finishRace(winnerId)
            }
          }
        }
      }, this.phaseTimeRemaining)
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
