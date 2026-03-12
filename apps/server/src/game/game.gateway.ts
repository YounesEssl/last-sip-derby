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
import { BOOST_DURATION_MS, DRINK_CONFIRM_TIMEOUT_MS } from '@last-sip-derby/shared'
import { GameService } from './game.service'
import { GameLoop } from './game.loop'
import { PersistenceService } from '../persistence/persistence.service'

@WebSocketGateway({
  cors: {
    origin: [
      process.env.TV_URL ?? 'http://localhost:3000',
      process.env.MOBILE_URL ?? 'http://localhost:3002',
    ],
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
    // Set up game loop callbacks
    this.gameLoop.setCallbacks({
      onStateUpdate: () => this.broadcastState(),
      onPhaseChange: (phase) => this.server.emit('game:phaseChange', phase),
      onEventTriggered: (result) => {
        this.server.emit('game:event', result.event)

        // Send drink notifications to affected players
        for (const notif of result.drinkNotifications) {
          const player = this.gameService.getPlayerByPseudo(notif.pseudo)
          if (player) {
            this.server.to(player.id).emit('player:drinkNotification', {
              sips: notif.sips,
              reason: notif.reason,
            })
            this.gameService.startDrinkTimer(notif.pseudo, () => {
              this.server.to(player.id).emit('player:drinkNotification', {
                sips: 1,
                reason: 'Penalite : dette non payee a temps !',
              })
              this.broadcastState()
            })
          }
        }

        // Send boost windows to affected players
        for (const boost of result.boostTargets) {
          this.server.to(boost.socketId).emit('player:boostWindow', {
            horseId: boost.horseId,
            durationMs: BOOST_DURATION_MS,
          })
        }
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

  @SubscribeMessage('player:tapBoost')
  handleTapBoost(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { horseId: string },
  ) {
    if (!data?.horseId) return
    if (this.gameService.getPhase() !== 'RACING') return

    const player = this.gameService.getPlayerBySocket(client.id)
    if (!player?.currentBet || player.currentBet.horseId !== data.horseId) return

    this.gameService.boostHorse(data.horseId)
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
