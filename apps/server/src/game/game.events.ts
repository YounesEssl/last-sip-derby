import { Injectable } from '@nestjs/common'
import { v4 as uuid } from 'uuid'
import {
  GameEvent,
  Horse,
  Player,
  EVENT_TITLES,
  EVENT_DESCRIPTIONS,
} from '@last-sip-derby/shared'
import { GameService } from './game.service'

@Injectable()
export class GameEvents {
  constructor(private gameService: GameService) {}

  generateEvent(): GameEvent | null {
    const horses = this.gameService.getHorses()
    const players = this.gameService.getConnectedPlayers()

    // Find horses that have at least one bet from a connected player
    const horsesWithBets = horses.filter(
      (h) => !h.isEliminated && players.some((p) => p.currentBet?.horseId === h.id),
    )
    if (horsesWithBets.length === 0) return null

    // Pick a random horse with bets
    const targetHorse = horsesWithBets[Math.floor(Math.random() * horsesWithBets.length)]

    // Split players into affected (bet on target) and non-affected (voters)
    const affectedPlayerIds: string[] = []
    const nonAffectedPlayerIds: string[] = []

    for (const p of players) {
      if (p.currentBet?.horseId === targetHorse.id) {
        affectedPlayerIds.push(p.id)
      } else {
        nonAffectedPlayerIds.push(p.id)
      }
    }

    // Need at least 1 voter, otherwise skip
    if (nonAffectedPlayerIds.length === 0) return null

    // Roll sips: 50% = 1, 30% = 2, 20% = 3
    const sipsRoll = Math.random()
    const sipsAmount = sipsRoll < 0.5 ? 1 : sipsRoll < 0.8 ? 2 : 3

    // Pick random title and description
    const title = EVENT_TITLES[Math.floor(Math.random() * EVENT_TITLES.length)]
    const rawDescription = EVENT_DESCRIPTIONS[Math.floor(Math.random() * EVENT_DESCRIPTIONS.length)]
    const description = rawDescription.replace(/\.\.\./g, targetHorse.name)

    const event: GameEvent = {
      id: uuid(),
      title,
      description,
      targetHorseId: targetHorse.id,
      targetHorseName: targetHorse.name,
      affectedPlayerIds,
      nonAffectedPlayerIds,
      sipsAmount,
      votes: {},
      votingDeadline: Date.now() + 30_000,
      resolved: false,
      horseEliminated: false,
    }

    return event
  }
}
