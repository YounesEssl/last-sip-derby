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

        // Send drink notifications to affected players — they have the whole
        // voting window (30s) to drink under the crowd's scrutiny
        for (const playerId of event.affectedPlayerIds) {
          this.server.to(playerId).emit('player:drinkNotification', {
            sips: event.sipsAmount,
            reason: event.description,
            deadline: event.votingDeadline,
          })

          // Add drink debt
          const player = this.gameService.getConnectedPlayers().find((p) => p.id === playerId)
          if (player) {
            player.debt += event.sipsAmount
            player.totalSipsDrunk += event.sipsAmount
            this.gameService.setPendingDrinkNotice(player.pseudo, {
              sips: event.sipsAmount,
              reason: event.description,
              deadline: event.votingDeadline,
            })
          }
        }
      },
      onEventResolved: (data) => {
        const event = this.gameService.getActiveEvent()
        if (event?.id === data.eventId) {
          for (const playerId of event.affectedPlayerIds) {
            const player = this.gameService.getAllPlayers().find((candidate) => candidate.id === playerId)
            if (player) this.gameService.clearPendingDrinkNotice(player.pseudo)
          }
        }
        this.server.emit('game:eventResolved', data)
      },
      onRaceFinished: () => {
        // Handled by game loop internally
      },
      onPlayersEliminated: (playerIds, reason) => {
        for (const playerId of playerIds) this.server.to(playerId).emit('player:eliminated', { reason })
      },
      onPlayersKicked: (playerIds) => {
        for (const playerId of playerIds) this.server.to(playerId).emit('player:sessionReset')
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
    // Reconnection is allowed so a known player can recover the pause screen.
    // A brand-new entry waits until the organiser closes the rulebook.
    if (this.gameService.isGamePaused() && !this.gameService.getPlayerByPseudo(sanitized)) {
      client.emit('game:stateUpdate', this.gameService.getState())
      return
    }

    const player = this.gameService.joinPlayer(client.id, sanitized)

    client.emit('player:joined', player)
    const pendingDrink = this.gameService.getPendingDrinkNotice(player.pseudo)
    if (pendingDrink) client.emit('player:drinkNotification', pendingDrink)
    this.broadcastState()
    this.gameLoop.onPlayerJoined()
  }

  @SubscribeMessage('player:bet')
  handleBet(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { horseId: string; amount: number },
  ) {
    if (this.gameService.isGamePaused()) return
    if (!data?.horseId || !data?.amount) return

    const bet = this.gameService.placeBet(client.id, data.horseId, data.amount)
    if (bet) {
      this.broadcastState()
      this.gameLoop.onBetPlaced()
    }
  }

  @SubscribeMessage('minigame:action')
  handleMiniGameAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; action: string; value?: number | string },
  ) {
    if (this.gameService.isGamePaused()) return
    if (!data?.gameId || !data?.action) return
    if (this.gameService.handleMiniGameAction(client.id, data.gameId, data.action, data.value)) {
      this.gameLoop.handleMiniGameAction()
    }
  }

  @SubscribeMessage('blackKnight:kill')
  handleBlackKnightKill(@ConnectedSocket() client: Socket, @MessageBody() data: { horseId: string }) {
    if (this.gameService.isGamePaused()) return
    if (!data?.horseId) return
    const execution = this.gameService.useBlackKnightPower(client.id, data.horseId)
    if (!execution) return
    for (const playerId of execution.affectedPlayerIds) {
      this.server.to(playerId).emit('player:eliminated', { reason: 'Ton cheval a été exécuté par le Cavalier Noir.' })
    }
    this.gameLoop.handleBlackKnightKill()
  }

  @SubscribeMessage('player:confirmDrink')
  handleConfirmDrink(@ConnectedSocket() client: Socket) {
    if (this.gameService.isGamePaused()) return
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
    if (this.gameService.isGamePaused()) return
    if (!data?.eventId || typeof data.valid !== 'boolean') return
    const player = this.gameService.getPlayerBySocket(client.id)
    if (!player) return
    this.gameLoop.handleVote(data.eventId, player.id, data.valid)
  }

  @SubscribeMessage('winner:distributeSips')
  handleDistributeSips(
    @ConnectedSocket() client: Socket,
    @MessageBody() allocations: Array<{ pseudo: string; sips: number }>,
  ) {
    if (this.gameService.isGamePaused()) return
    const applied = this.gameService.distributeSips(client.id, allocations)
    if (!applied) return

    const winner = this.gameService.getPlayerBySocket(client.id)
    for (const target of applied) {
      const deadline = Date.now() + 15_000
      const reason = `🏆 ${winner?.pseudo ?? 'Le vainqueur'} t'envoie ${target.sips} gorgée${target.sips > 1 ? 's' : ''} — santé !`
      this.gameService.setPendingDrinkNotice(target.pseudo, { sips: target.sips, reason, deadline })
      this.server.to(target.id).emit('player:drinkNotification', {
        sips: target.sips,
        reason,
        deadline,
      })
    }
    this.broadcastState()
  }

  @SubscribeMessage('dev:startRace')
  handleDevStartRace() {
    if (this.gameService.isGamePaused()) return
    this.gameLoop.forceStartRace()
  }

  @SubscribeMessage('dev:resetRace')
  handleDevResetRace() {
    if (this.gameService.isGamePaused()) return
    this.gameLoop.forceResetRace()
  }

  @SubscribeMessage('master:resetSession')
  handleMasterResetSession() {
    if (this.gameService.isGamePaused()) return
    this.server.emit('player:sessionReset')
    this.gameLoop.forceResetRace()
    this.gameService.resetSession()
    this.broadcastState()
  }

  @SubscribeMessage('rules:setOpen')
  handleRulesSetOpen(@MessageBody() open: boolean) {
    if (typeof open !== 'boolean') return
    if (open) this.gameLoop.pauseForRules()
    else this.gameLoop.resumeFromRules()
  }

  private broadcastState() {
    this.server.emit('game:stateUpdate', this.gameService.getState())
  }
}
