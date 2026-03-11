import { Module } from '@nestjs/common'
import { GameModule } from './game/game.module'
import { PersistenceService } from './persistence/persistence.service'

@Module({
  imports: [GameModule],
  providers: [PersistenceService],
  exports: [PersistenceService],
})
export class AppModule {}
