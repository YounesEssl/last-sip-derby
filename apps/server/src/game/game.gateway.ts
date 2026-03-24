import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets'
import { OnModuleInit } from '@nestjs/common'
import { Server, Socket } from 'socket.io'
import { DRINK_CONFIRM_TIMEOUT_MS } from '@last-sip-derby/shared'
import { GameService } from './game.service'
import { GameLoop } from './game.loop'
import { PersistenceService } from '../persistence/persistence.service'

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server!: Server

  private dumpInterval: NodeJS.Timeout | null = null

  constructor(
    private gameService: GameService,
    private gameLoop: GameLoop,
    private persistence: PersistenceService,
  ) {}

  onModuleInit() {
    this.gameLoop.setCallbacks({
      onStateUpdate: () => this.broadcastState(),
      onPhaseChange: (phase) => this.server.emit('game:phaseChange', phase),
      onEventTriggered: (event) => {
        this.server.emit('game:event', event)

        // Send drink notifications to affected players
        for (const playerId of event.affectedPlayerIds) {
          this.server.to(playerId).emit('player:drinkNotification', {
            sips: event.sipsAmount,
            reason: event.description,
          })

          // Add drink debt
          const player = this.gameService.getConnectedPlayers().find((p) => p.id === playerId)
          if (player) {
            player.debt += event.sipsAmount
            player.totalSipsDrunk += event.sipsAmount
          }
        }
      },
      onEventResolved: (data) => {
        this.server.emit('game:eventResolved', data)
      },
      onRaceFinished: () => {
        // Handled by game loop internally
      },
    })

    // Set up periodic state dump
    const dumpInterval = parseInt(process.env.STATE_DUMP_INTERVAL_MS ?? '300000', 10)
    this.dumpInterval = setInterval(() => {
      this.persistence.dump(this.gameService.getDumpData())
    }, dumpInterval)
  }

  handleConnection(client: Socket) {
    client.emit('game:stateUpdate', this.gameService.getState())
  }

  handleDisconnect(client: Socket) {
    const player = this.gameService.disconnectPlayer(client.id)
    if (player) {
      this.broadcastState()
    }
  }

  @SubscribeMessage('player:join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() pseudo: string,
  ) {
    if (!pseudo || typeof pseudo !== 'string' || pseudo.trim().length === 0) return
    const sanitized = pseudo.trim().slice(0, 20)

    const player = this.gameService.joinPlayer(client.id, sanitized)

    client.emit('player:joined', player)
    this.broadcastState()
    this.gameLoop.onPlayerJoined()
  }

  @SubscribeMessage('player:bet')
  handleBet(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { horseId: string; amount: number },
  ) {
    if (!data?.horseId || !data?.amount) return

    const bet = this.gameService.placeBet(client.id, data.horseId, data.amount)
    if (bet) {
      this.broadcastState()
    }
  }

  @SubscribeMessage('player:confirmDrink')
  handleConfirmDrink(@ConnectedSocket() client: Socket) {
    const confirmed = this.gameService.confirmDrink(client.id)
    if (confirmed > 0) {
      this.broadcastState()
    }
  }

  @SubscribeMessage('player:vote')
  handleVote(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { eventId: string; valid: boolean },
  ) {
    if (!data?.eventId || typeof data.valid !== 'boolean') return
    const player = this.gameService.getPlayerBySocket(client.id)
    if (!player) return
    this.gameLoop.handleVote(data.eventId, player.id, data.valid)
  }

  @SubscribeMessage('dev:startRace')
  handleDevStartRace() {
    this.gameLoop.forceStartRace()
  }

  @SubscribeMessage('dev:resetRace')
  handleDevResetRace() {
    this.gameLoop.forceResetRace()
  }

  private broadcastState() {
    this.server.emit('game:stateUpdate', this.gameService.getState())
  }
}
