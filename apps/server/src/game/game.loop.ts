import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { RACE_TICK_MS, EVENT_MIN_INTERVAL_MS } from '@last-sip-derby/shared'
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
    this.gameService.startIdle()
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

  onPlayerJoined() {
    if (this.gameService.getPhase() === 'IDLE' && this.gameService.hasConnectedPlayers()) {
      this.transitionToBetting()
    }
  }

  forceStartRace() {
    this.clearTimers()
    this.gameService.startBetting()
    this.gameService.startRacing()
    this.onPhaseChange?.('RACING')
    this.onStateUpdate?.()
    this.lastEventTime = Date.now()

    this.raceInterval = setInterval(() => {
      const winner = this.gameService.tickRace()
      this.onStateUpdate?.()

      if (winner) {
        this.finishRace(winner.id)
      }
    }, RACE_TICK_MS)

    const maxDuration = this.gameService.getState().phaseDuration
    this.phaseTimeout = setTimeout(() => {
      if (this.gameService.getPhase() === 'RACING') {
        const horses = this.gameService.getHorses()
        const best = [...horses].sort((a, b) => b.position - a.position)[0]
        if (best) {
          best.position = 100
          this.finishRace(best.id)
        }
      }
    }, maxDuration)
  }

  forceResetRace() {
    this.clearTimers()
    this.gameService.startBetting()
    this.onPhaseChange?.('IDLE')
    this.onStateUpdate?.()
  }

  private clearTimers() {
    if (this.raceInterval) clearInterval(this.raceInterval)
    if (this.phaseTimeout) clearTimeout(this.phaseTimeout)
    if (this.eventTimeout) clearTimeout(this.eventTimeout)
    this.raceInterval = null
    this.phaseTimeout = null
    this.eventTimeout = null
  }

  private transitionToIdle() {
    this.clearTimers()
    this.gameService.startIdle()
    this.onPhaseChange?.('IDLE')
    this.onStateUpdate?.()
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
    this.lastEventTime = Date.now()

    this.raceInterval = setInterval(() => {
      const winner = this.gameService.tickRace()
      this.onStateUpdate?.()

      const now = Date.now()
      if (now - this.lastEventTime > EVENT_MIN_INTERVAL_MS) {
        const eventResult = this.gameEvents.tryGenerateEvent()
        if (eventResult) {
          this.lastEventTime = now
          this.gameService.setActiveEvent(eventResult.event)
          this.onEventTriggered?.(eventResult)

          const expiresIn = eventResult.event.expiresAt - now
          this.eventTimeout = setTimeout(() => {
            this.gameService.clearActiveEvent()
            this.onStateUpdate?.()
          }, expiresIn)
        }
      }

      if (winner) {
        this.finishRace(winner.id)
      }
    }, RACE_TICK_MS)

    const maxDuration = this.gameService.getState().phaseDuration
    this.phaseTimeout = setTimeout(() => {
      if (this.gameService.getPhase() === 'RACING') {
        const horses = this.gameService.getHorses()
        const best = [...horses].sort((a, b) => b.position - a.position)[0]
        if (best) {
          best.position = 100
          this.finishRace(best.id)
        }
      }
    }, maxDuration)
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
      if (this.gameService.hasConnectedPlayers()) {
        this.transitionToBetting()
      } else {
        this.transitionToIdle()
      }
    }, resultsDuration)
  }
}
