import { Injectable } from '@nestjs/common'
import { v4 as uuid } from 'uuid'
import {
  GameEvent,
  GameEventType,
  Horse,
  Player,
  STUN_DURATION_MS,
  CHUTE_STUN_DURATION_MS,
  BOOST_DURATION_MS,
} from '@last-sip-derby/shared'
import { GameService } from './game.service'

export interface EventResult {
  event: GameEvent
  drinkNotifications: Array<{ pseudo: string; sips: number; reason: string }>
  boostTargets: Array<{ socketId: string; horseId: string }>
}

@Injectable()
export class GameEvents {
  constructor(private gameService: GameService) {}

  tryGenerateEvent(): EventResult | null {
    const horses = this.gameService.getHorses()
    if (horses.length === 0) return null

    const roll = Math.random()
    if (roll > 0.03) return null // ~3% chance per tick = roughly every 3s at 100ms ticks

    const types: GameEventType[] = [
      'ANTIDOPING',
      'COUP_DE_FOUET',
      'CHUTE_COLLECTIVE',
      'OBSTACLE_IMPREVU',
    ]

    // Weight: chute collective is rarer
    const weights = [0.3, 0.35, 0.1, 0.25]
    const type = this.weightedRandom(types, weights)

    switch (type) {
      case 'ANTIDOPING':
        return this.antidoping(horses)
      case 'COUP_DE_FOUET':
        return this.coupDeFouet(horses)
      case 'CHUTE_COLLECTIVE':
        return this.chuteCollective(horses)
      case 'OBSTACLE_IMPREVU':
        return this.obstacleImprevu(horses)
    }
  }

  private antidoping(horses: Horse[]): EventResult {
    // Target the horse in the lead
    const leader = [...horses]
      .filter((h) => !h.isStunned)
      .sort((a, b) => b.position - a.position)[0]

    if (!leader) return this.coupDeFouet(horses)

    this.gameService.stunHorse(leader.id, STUN_DURATION_MS)

    const affectedPlayers = this.getPlayersWhobet(leader.id)
    const drinkNotifications = affectedPlayers.map((p) => ({
      pseudo: p.pseudo,
      sips: 1,
      reason: `Controle antidopage sur ${leader.name} !`,
    }))

    // Apply debt
    for (const p of affectedPlayers) {
      p.debt += 1
      p.totalSipsDrunk += 1
    }

    const event: GameEvent = {
      id: uuid(),
      type: 'ANTIDOPING',
      affectedHorseId: leader.id,
      affectedPlayerIds: affectedPlayers.map((p) => p.id),
      message: `CONTROLE ANTIDOPAGE - ${leader.name} ralenti ! Ses parieurs boivent 1G !`,
      sipsAmount: 1,
      expiresAt: Date.now() + STUN_DURATION_MS,
    }

    return { event, drinkNotifications, boostTargets: [] }
  }

  private coupDeFouet(horses: Horse[]): EventResult {
    const eligible = horses.filter((h) => !h.isStunned && h.position < 90)
    if (eligible.length === 0) {
      return {
        event: this.makeSimpleEvent('COUP_DE_FOUET', 'Coup de fouet rate !'),
        drinkNotifications: [],
        boostTargets: [],
      }
    }

    const horse = eligible[Math.floor(Math.random() * eligible.length)]
    const betters = this.getPlayersWhobet(horse.id)

    const event: GameEvent = {
      id: uuid(),
      type: 'COUP_DE_FOUET',
      affectedHorseId: horse.id,
      affectedPlayerIds: betters.map((p) => p.id),
      message: `COUP DE FOUET ! Tapez pour booster ${horse.name} !`,
      expiresAt: Date.now() + BOOST_DURATION_MS,
    }

    const boostTargets = betters.map((p) => ({
      socketId: p.id,
      horseId: horse.id,
    }))

    return { event, drinkNotifications: [], boostTargets }
  }

  private chuteCollective(horses: Horse[]): EventResult {
    // All horses except the last one get stunned
    const sorted = [...horses].sort((a, b) => a.position - b.position)
    const last = sorted[0]

    for (const horse of horses) {
      if (horse.id !== last.id) {
        this.gameService.stunHorse(horse.id, CHUTE_STUN_DURATION_MS)
      }
    }

    const event: GameEvent = {
      id: uuid(),
      type: 'CHUTE_COLLECTIVE',
      message: `CHUTE COLLECTIVE ! Tous les chevaux tombent sauf ${last.name} !`,
      expiresAt: Date.now() + CHUTE_STUN_DURATION_MS,
    }

    return { event, drinkNotifications: [], boostTargets: [] }
  }

  private obstacleImprevu(horses: Horse[]): EventResult {
    const eligible = horses.filter((h) => !h.isStunned)
    if (eligible.length === 0) {
      return {
        event: this.makeSimpleEvent('OBSTACLE_IMPREVU', 'Obstacle imprevu, mais personne n\'est touche !'),
        drinkNotifications: [],
        boostTargets: [],
      }
    }

    const horse = eligible[Math.floor(Math.random() * eligible.length)]
    this.gameService.stunHorse(horse.id, STUN_DURATION_MS)

    const betters = this.getPlayersWhobet(horse.id)
    const drinkNotifications = betters.map((p) => ({
      pseudo: p.pseudo,
      sips: 2,
      reason: `${horse.name} s'est pris un obstacle ! Tu bois 2G !`,
    }))

    for (const p of betters) {
      p.debt += 2
      p.totalSipsDrunk += 2
    }

    const event: GameEvent = {
      id: uuid(),
      type: 'OBSTACLE_IMPREVU',
      affectedHorseId: horse.id,
      affectedPlayerIds: betters.map((p) => p.id),
      message: `OBSTACLE IMPREVU ! ${horse.name} trebuche ! Ses parieurs boivent 2G !`,
      sipsAmount: 2,
      expiresAt: Date.now() + STUN_DURATION_MS,
    }

    return { event, drinkNotifications, boostTargets: [] }
  }

  private getPlayersWhobet(horseId: string): Player[] {
    return this.gameService
      .getConnectedPlayers()
      .filter((p) => p.currentBet?.horseId === horseId)
  }

  private makeSimpleEvent(type: GameEventType, message: string): GameEvent {
    return {
      id: uuid(),
      type,
      message,
      expiresAt: Date.now() + 3000,
    }
  }

  private weightedRandom<T>(items: T[], weights: number[]): T {
    const total = weights.reduce((a, b) => a + b, 0)
    let r = Math.random() * total
    for (let i = 0; i < items.length; i++) {
      r -= weights[i]
      if (r <= 0) return items[i]
    }
    return items[items.length - 1]
  }
}
