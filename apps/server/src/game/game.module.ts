import { Module } from '@nestjs/common'
import { GameGateway } from './game.gateway'
import { GameService } from './game.service'
import { GameLoop } from './game.loop'
import { GameEvents } from './game.events'
import { PersistenceService } from '../persistence/persistence.service'

@Module({
  providers: [GameGateway, GameService, GameLoop, GameEvents, PersistenceService],
})
export class GameModule {}
