import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { RACE_TICK_MS, EVENT_MIN_INTERVAL_MS, EVENT_MAX_INTERVAL_MS } from '@last-sip-derby/shared'
import { GameService } from './game.service'
import { GameEvents, EventResult } from './game.events'

@Injectable()
export class GameLoop implements OnModuleInit, OnModuleDestroy {
  private raceInterval: NodeJS.Timeout | null = null
  private phaseTimeout: NodeJS.Timeout | null = null
  private eventTimeout: NodeJS.Timeout | null = null
  private lastEventTime = 0

  private onStateUpdate: (() => void) | null = null
  private onPhaseChange: ((phase: string) => void) | null = null
  private onEventTriggered: ((result: EventResult) => void) | null = null
  private onRaceFinished: ((winnerId: string) => void) | null = null

  constructor(
    private gameService: GameService,
    private gameEvents: GameEvents,
  ) {}

  onModuleInit() {
    // Start the loop after a short delay to let everything initialize
    setTimeout(() => this.runPhase(), 1000)
  }

  onModuleDestroy() {
    this.clearTimers()
  }

  setCallbacks(callbacks: {
    onStateUpdate: () => void
    onPhaseChange: (phase: string) => void
    onEventTriggered: (result: EventResult) => void
    onRaceFinished: (winnerId: string) => void
  }) {
    this.onStateUpdate = callbacks.onStateUpdate
    this.onPhaseChange = callbacks.onPhaseChange
    this.onEventTriggered = callbacks.onEventTriggered
    this.onRaceFinished = callbacks.onRaceFinished
  }

  private clearTimers() {
    if (this.raceInterval) clearInterval(this.raceInterval)
    if (this.phaseTimeout) clearTimeout(this.phaseTimeout)
    if (this.eventTimeout) clearTimeout(this.eventTimeout)
    this.raceInterval = null
    this.phaseTimeout = null
    this.eventTimeout = null
  }

  private runPhase() {
    this.clearTimers()

    const hasPlayers = this.gameService.hasConnectedPlayers()
    const phase = this.gameService.getPhase()

    if (!hasPlayers && phase !== 'RACING') {
      // No players: run idle races for ambiance
      this.gameService.startIdle()
      this.onPhaseChange?.('IDLE')
      this.onStateUpdate?.()

      // After idle, start a demo race
      this.phaseTimeout = setTimeout(() => {
        this.gameService.startBetting()
        this.onPhaseChange?.('IDLE') // Still IDLE phase semantically
        this.onStateUpdate?.()

        // Skip to racing quickly in idle mode
        this.phaseTimeout = setTimeout(() => {
          this.startRacing()
        }, 5000)
      }, 5000)
      return
    }

    // Normal flow
    switch (phase) {
      case 'IDLE':
        this.transitionToBetting()
        break
      case 'BETTING':
        this.transitionToBetting()
        break
      case 'RACING':
        this.startRacing()
        break
      case 'RESULTS':
        this.transitionToResults()
        break
    }
  }

  private transitionToBetting() {
    this.gameService.startBetting()
    this.onPhaseChange?.('BETTING')
    this.onStateUpdate?.()

    // After betting duration, start racing
    const duration = this.gameService.getState().phaseDuration
    this.phaseTimeout = setTimeout(() => {
      this.startRacing()
    }, duration)
  }

  private startRacing() {
    this.gameService.startRacing()
    this.onPhaseChange?.('RACING')
    this.onStateUpdate?.()
    this.lastEventTime = Date.now()

    // Race tick
    this.raceInterval = setInterval(() => {
      const winner = this.gameService.tickRace()
      this.onStateUpdate?.()

      // Try events
      const now = Date.now()
      if (now - this.lastEventTime > EVENT_MIN_INTERVAL_MS) {
        const eventResult = this.gameEvents.tryGenerateEvent()
        if (eventResult) {
          this.lastEventTime = now
          this.gameService.setActiveEvent(eventResult.event)
          this.onEventTriggered?.(eventResult)

          // Clear event after expiry
          const expiresIn = eventResult.event.expiresAt - now
          this.eventTimeout = setTimeout(() => {
            this.gameService.clearActiveEvent()
            this.onStateUpdate?.()
          }, expiresIn)
        }
      }

      if (winner) {
        this.clearTimers()
        this.onRaceFinished?.(winner.id)

        // Transition to results
        const result = this.gameService.startResults(winner)
        this.onPhaseChange?.('RESULTS')
        this.onStateUpdate?.()

        // After results, back to betting
        const resultsDuration = this.gameService.getState().phaseDuration
        this.phaseTimeout = setTimeout(() => {
          this.transitionToBetting()
        }, resultsDuration)
      }
    }, RACE_TICK_MS)

    // Safety: max race duration
    const maxDuration = this.gameService.getState().phaseDuration
    this.phaseTimeout = setTimeout(() => {
      if (this.gameService.getPhase() === 'RACING') {
        // Force finish: pick horse with highest position
        const horses = this.gameService.getHorses()
        const best = [...horses].sort((a, b) => b.position - a.position)[0]
        if (best) {
          best.position = 100
          this.clearTimers()
          this.onRaceFinished?.(best.id)

          const result = this.gameService.startResults(best)
          this.onPhaseChange?.('RESULTS')
          this.onStateUpdate?.()

          const resultsDuration = this.gameService.getState().phaseDuration
          this.phaseTimeout = setTimeout(() => {
            this.transitionToBetting()
          }, resultsDuration)
        }
      }
    }, maxDuration)
  }

  private transitionToResults() {
    // This shouldn't normally be called directly
    // Results are triggered after race finishes
    const duration = this.gameService.getState().phaseDuration
    this.phaseTimeout = setTimeout(() => {
      this.transitionToBetting()
    }, duration)
  }
}
