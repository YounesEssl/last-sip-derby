import { Injectable, OnModuleInit } from "@nestjs/common";
import { v4 as uuid } from "uuid";
import {
  GameState,
  GamePhase,
  Horse,
  Player,
  Bet,
  GameEvent,
  horseNamesBySips,
  HORSE_COLORS,
  MAX_ACTIVE_PLAYERS,
  DRINK_CONFIRM_TIMEOUT_MS,
  DRINK_PENALTY_SIPS,
  PHASE_DURATIONS,
  PLAYER_INACTIVITY_MS,
  BLACK_KNIGHT_KILL_COOLDOWN_MS,
  MiniGameState,
  MiniGameType,
  RACE_EVENT_ODDS,
  RACE_SPEED_BONUSES,
  MINI_GAME_DURATIONS,
  MINI_GAME_TYPES,
  applyMiniGameAction,
  resolveMiniGameState,
  shouldEndMiniGameEarly,
  MAZE_BANK_SIZE,
} from "@last-sip-derby/shared";
import { PersistenceService } from "../persistence/persistence.service";

// ── Scripted race: outcome decided before the race, animation is pure spectacle ──
//
// Each horse follows a smooth plan: position(p) = base(p) + wiggle(p), where
// `base` runs linearly from its anchor to its scripted finish position and
// `wiggle` is a sum of windowed sine waves (zero at the start and at the
// finish line). Positions are computed directly from race progress — never
// integrated — so horses can NEVER stall, teleport or overshoot. Lead changes
// happen early while the base curves are still close; the script wins late.
const SIPS_ODDS = [1, 2, 3, 5, 7] as const;
const RACE_TICKS = 600; // ~60s race — snappier
const FINISH_POSITIONS = [100, 98, 95.5, 92.5, 89]; // winner → last: everyone in the picture

// Win probability weights per sip value
const WIN_WEIGHTS: Record<number, number> = { 1: 35, 2: 25, 3: 18, 5: 13, 7: 8 };

interface Wave {
  amp: number;
  freq: number; // cycles over the whole race
  phase: number;
}

/** A choreographed spell in the lead: rise to ~1.5 units above everyone,
 *  hold around `mid`, then fade slowly enough to never run backwards. */
interface LeadAct {
  mid: number; // progress at the peak
  halfUp: number;
  halfDown: number;
  amp: number;
}

interface HorseRaceState {
  finishRank: number; // 0=winner (pre-determined, re-ranked on elimination)
  targetFinishPos: number; // from FINISH_POSITIONS
  anchorPos: number; // plan segment start (moves on re-rank)
  anchorProgress: number;
  waves: Wave[];
  leadActs: LeadAct[];
  gateBurst: number; // early surge amplitude
  prevPos: number;
  jockeyFallTick: number | null;
  jockeyBoostStartTick: number | null;
  reverseTick: number | null;
  boostBonus: number;
}

interface PausableDrinkTimer {
  timeout: NodeJS.Timeout | null;
  dueAt: number;
  remainingMs: number;
  onPenalty: () => void;
}

interface PendingDrinkNotice {
  sips: number;
  reason: string;
  deadline: number;
}

function smooth01(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

const CAPITALS = [
  [
    ['Algérie','Alger'],['Allemagne','Berlin'],['Argentine','Buenos Aires'],['Autriche','Vienne'],['Belgique','Bruxelles'],['Chili','Santiago'],['Chine','Pékin'],['Colombie','Bogota'],['Corée du Sud','Séoul'],['Cuba','La Havane'],['Danemark','Copenhague'],['Égypte','Le Caire'],['Espagne','Madrid'],['États-Unis','Washington, D.C.'],['France','Paris'],['Grèce','Athènes'],['Inde','New Delhi'],['Irak','Bagdad'],['Irlande','Dublin'],['Israël','Jérusalem'],['Italie','Rome'],['Japon','Tokyo'],['Liban','Beyrouth'],['Maroc','Rabat'],['Mexique','Mexico'],['Norvège','Oslo'],['Pays-Bas','Amsterdam'],['Pérou','Lima'],['Pologne','Varsovie'],['Portugal','Lisbonne'],['République Tchèque','Prague'],['Royaume-Uni','Londres'],['Russie','Moscou'],['Sénégal','Dakar'],['Suède','Stockholm'],['Thaïlande','Bangkok'],['Tunisie','Tunis'],['Ukraine','Kiev'],
  ],
  [
    ['Afrique du Sud','Pretoria'],['Arabie Saoudite','Riyad'],['Australie','Canberra'],['Brésil','Brasilia'],['Bulgarie','Sofia'],['Canada','Ottawa'],['Costa Rica','San José'],["Côte d'Ivoire",'Yamoussoukro'],['Croatie','Zagreb'],['Émirats Arabes Unis','Abou Dabi'],['Équateur','Quito'],['Éthiopie','Addis-Abeba'],['Finlande','Helsinki'],['Hongrie','Budapest'],['Indonésie','Jakarta'],['Iran','Téhéran'],['Islande','Reykjavik'],['Jamaïque','Kingston'],['Kenya','Nairobi'],['Madagascar','Antananarivo'],['Malaisie','Kuala Lumpur'],['Nigeria','Abuja'],['Nouvelle-Zélande','Wellington'],['Pakistan','Islamabad'],['Philippines','Manille'],['Qatar','Doha'],['République Démocratique du Congo','Kinshasa'],['Roumanie','Bucarest'],['Serbie','Belgrade'],['Singapour','Singapour'],['Slovaquie','Bratislava'],['Suisse','Berne'],['Syrie','Damas'],['Turquie','Ankara'],['Venezuela','Caracas'],['Vietnam','Hanoï'],
  ],
  [
    ['Afghanistan','Kaboul'],['Angola','Luanda'],['Bangladesh','Dacca'],['Bolivie','La Paz / Sucre'],['Cambodge','Phnom Penh'],['Cameroun','Yaoundé'],['Corée du Nord','Pyongyang'],['Estonie','Tallinn'],['Fidji','Suva'],['Ghana','Accra'],['Guatemala','Guatemala'],['Haïti','Port-au-Prince'],['Jordanie','Amman'],['Kazakhstan','Astana'],['Lettonie','Riga'],['Lituanie','Vilnius'],['Mali','Bamako'],['Népal','Katmandou'],['Ouzbékistan','Tachkent'],['Panama','Panama'],['Papouasie-Nouvelle-Guinée','Port Moresby'],['Paraguay','Asuncion'],['République Dominicaine','Saint-Domingue'],['Sri Lanka','Colombo'],['Taïwan','Taipei'],['Uruguay','Montevideo'],
  ],
] as const;

@Injectable()
export class GameService implements OnModuleInit {
  private state: GameState = {
    serverNow: Date.now(),
    isRulesOpen: false,
    isGamePaused: false,
    pausedAt: null,
    pauseReason: null,
    phase: "IDLE",
    raceNumber: 0,
    horses: [],
    players: [],
    eveningLeaderboard: [],
    roundDrinks: [],
    queue: [],
    activeEvent: null,
    lightningEvent: null,
    miniGame: null,
    executionEvent: null,
    racePaused: false,
    raceProgress: 0,
    phaseStartedAt: Date.now(),
    phaseDuration: PHASE_DURATIONS.IDLE,
    lastRaceWinner: null,
  };

  private playersByPseudo: Map<string, Player> = new Map();
  private socketToPlayer: Map<string, string> = new Map(); // socketId -> pseudo
  private drinkTimers: Map<string, PausableDrinkTimer> = new Map();
  private pendingDrinkNotices: Map<string, PendingDrinkNotice> = new Map();
  private kickedSocketIds: string[] = [];

  // Race simulation state (reset each race)
  private horseRaceStates: Map<string, HorseRaceState> = new Map();
  private raceTick = 0;
  private finishOrder: string[] = [];

  constructor(private persistence: PersistenceService) {}

  async onModuleInit() {
    const restored = await this.persistence.tryRestore();
    if (restored) {
      for (const p of restored.players) {
        const player: Player = {
          ...p,
          id: "",
          isConnected: false,
          currentBet: null,
          lastSeen: Date.now(),
          lastBetAt: (p as Player).lastBetAt ?? Date.now(),
          miniGameEliminated: false,
          blackKnightKillsUsed: 0,
          blackKnightLastKillAt: 0,
        };
        this.playersByPseudo.set(p.pseudo, player);
      }
      this.state.raceNumber = restored.raceNumber;
      console.log(
        `Restored ${restored.players.length} players, race #${restored.raceNumber}`,
      );
    }
  }

  getState(): GameState {
    this.state.serverNow = this.state.isGamePaused && this.state.pausedAt !== null
      ? this.state.pausedAt
      : Date.now();
    this.state.players = this.getConnectedPlayers();
    this.state.eveningLeaderboard = Array.from(this.playersByPseudo.values())
      .sort((a, b) => b.totalSipsDrunk - a.totalSipsDrunk)
      .map((player) => ({ ...player, currentBet: null, id: "", isConnected: false }));
    return { ...this.state };
  }

  getPhase(): GamePhase {
    return this.state.phase;
  }

  isGamePaused(): boolean {
    return this.state.isGamePaused;
  }

  getRaceNumber(): number {
    return this.state.raceNumber;
  }

  getHorses(): Horse[] {
    return this.state.horses;
  }

  getConnectedPlayers(): Player[] {
    return Array.from(this.playersByPseudo.values()).filter(
      (p) => p.isConnected,
    );
  }

  getAllPlayers(): Player[] {
    return Array.from(this.playersByPseudo.values());
  }

  getPlayerBySocket(socketId: string): Player | undefined {
    const pseudo = this.socketToPlayer.get(socketId);
    if (!pseudo) return undefined;
    return this.playersByPseudo.get(pseudo);
  }

  getPlayerByPseudo(pseudo: string): Player | undefined {
    return this.playersByPseudo.get(pseudo);
  }

  setPendingDrinkNotice(pseudo: string, notice: PendingDrinkNotice): void {
    this.pendingDrinkNotices.set(pseudo, { ...notice });
  }

  getPendingDrinkNotice(pseudo: string): PendingDrinkNotice | null {
    const notice = this.pendingDrinkNotices.get(pseudo);
    if (!notice) return null;
    const now = this.state.isGamePaused && this.state.pausedAt !== null ? this.state.pausedAt : Date.now();
    if (notice.deadline <= now) {
      this.pendingDrinkNotices.delete(pseudo);
      return null;
    }
    return { ...notice };
  }

  clearPendingDrinkNotice(pseudo: string): void {
    this.pendingDrinkNotices.delete(pseudo);
  }

  hasConnectedPlayers(): boolean {
    return Array.from(this.playersByPseudo.values()).some((p) => p.isConnected);
  }

  /**
   * Freeze the shared game clock for the rulebook. Race-specific pauses
   * (incident/mini-game) remain untouched so their exact state can resume.
   */
  pauseForRules(pausedAt = Date.now()): boolean {
    if (this.state.isGamePaused) return false;

    this.state.isRulesOpen = true;
    this.state.isGamePaused = true;
    this.state.pausedAt = pausedAt;
    this.state.pauseReason = "RULEBOOK";
    this.state.serverNow = pausedAt;

    for (const timer of this.drinkTimers.values()) {
      if (timer.timeout) clearTimeout(timer.timeout);
      timer.timeout = null;
      timer.remainingMs = Math.max(0, timer.dueAt - pausedAt);
    }
    return true;
  }

  /** Resume every absolute deadline from the exact remaining duration. */
  resumeFromRules(resumedAt = Date.now()): number | null {
    if (!this.state.isGamePaused || this.state.pauseReason !== "RULEBOOK" || this.state.pausedAt === null) {
      return null;
    }

    const pauseDuration = Math.max(0, resumedAt - this.state.pausedAt);
    this.shiftGameTimestamps(pauseDuration);
    this.state.isRulesOpen = false;
    this.state.isGamePaused = false;
    this.state.pausedAt = null;
    this.state.pauseReason = null;
    this.state.serverNow = resumedAt;

    for (const [pseudo, timer] of this.drinkTimers) {
      this.armDrinkTimer(pseudo, timer, resumedAt);
    }
    return pauseDuration;
  }

  private shiftGameTimestamps(durationMs: number): void {
    if (durationMs <= 0) return;
    const pauseStart = this.state.pausedAt ?? Date.now() - durationMs;
    const resumedAt = pauseStart + durationMs;
    this.state.phaseStartedAt += durationMs;

    if (this.state.activeEvent) this.state.activeEvent.votingDeadline += durationMs;
    if (this.state.lightningEvent) {
      this.state.lightningEvent.startedAt += durationMs;
      this.state.lightningEvent.strikeAt += durationMs;
      this.state.lightningEvent.clearAt += durationMs;
      this.state.lightningEvent.endsAt += durationMs;
    }
    if (this.state.miniGame) {
      this.state.miniGame.startedAt += durationMs;
      this.state.miniGame.endsAt += durationMs;
      if (this.state.miniGame.resultsEndAt !== null) this.state.miniGame.resultsEndAt += durationMs;
      for (const row of this.state.miniGame.players) {
        if (row.finishedAt !== null) row.finishedAt += durationMs;
      }
    }
    if (this.state.executionEvent) {
      this.state.executionEvent.startedAt += durationMs;
      this.state.executionEvent.endsAt += durationMs;
    }
    for (const notice of this.pendingDrinkNotices.values()) notice.deadline += durationMs;

    for (const player of this.playersByPseudo.values()) {
      player.lastSeen = player.lastSeen <= pauseStart ? player.lastSeen + durationMs : resumedAt;
      player.lastBetAt = player.lastBetAt <= pauseStart ? player.lastBetAt + durationMs : resumedAt;
      if (player.blackKnightLastKillAt > 0) {
        player.blackKnightLastKillAt = player.blackKnightLastKillAt <= pauseStart
          ? player.blackKnightLastKillAt + durationMs
          : resumedAt;
      }
    }
  }

  private armDrinkTimer(pseudo: string, timer: PausableDrinkTimer, now = Date.now()): void {
    if (this.state.isGamePaused) return;
    timer.dueAt = now + timer.remainingMs;
    timer.timeout = setTimeout(() => {
      const current = this.drinkTimers.get(pseudo);
      if (current !== timer) return;
      const player = this.playersByPseudo.get(pseudo);
      if (player && player.debt > 0) {
        player.debt += DRINK_PENALTY_SIPS;
        timer.onPenalty();
      }
      this.drinkTimers.delete(pseudo);
    }, timer.remainingMs);
  }

  // Player management
  joinPlayer(socketId: string, pseudo: string): Player {
    const existing = this.playersByPseudo.get(pseudo);
    if (existing) {
      // Reconnection
      const previousSocketId = existing.id;
      if (previousSocketId && previousSocketId !== socketId) {
        this.socketToPlayer.delete(previousSocketId);
        if (existing.currentBet) existing.currentBet.playerId = socketId;

        const event = this.state.activeEvent;
        if (event) {
          event.affectedPlayerIds = event.affectedPlayerIds.map((id) => id === previousSocketId ? socketId : id);
          event.nonAffectedPlayerIds = event.nonAffectedPlayerIds.map((id) => id === previousSocketId ? socketId : id);
          if (Object.prototype.hasOwnProperty.call(event.votes, previousSocketId)) {
            event.votes[socketId] = event.votes[previousSocketId];
            delete event.votes[previousSocketId];
          }
        }

        const miniGamePlayer = this.state.miniGame?.players.find((row) => row.playerId === previousSocketId);
        if (miniGamePlayer) miniGamePlayer.playerId = socketId;
      }
      existing.id = socketId;
      existing.isConnected = true;
      existing.lastSeen = Date.now();
      this.socketToPlayer.set(socketId, pseudo);
      return existing;
    }

    const player: Player = {
      id: socketId,
      pseudo,
      isConnected: true,
      currentBet: null,
      totalSipsGiven: 0,
      totalSipsDrunk: 0,
      debt: 0,
      lastSeen: Date.now(),
      lastBetAt: Date.now(),
      miniGameEliminated: false,
      blackKnightKillsUsed: 0,
      blackKnightLastKillAt: 0,
    };

    this.playersByPseudo.set(pseudo, player);
    this.socketToPlayer.set(socketId, pseudo);

    // Add to queue or active depending on phase and count
    const active = this.getConnectedPlayers();
    if (active.length > MAX_ACTIVE_PLAYERS) {
      this.state.queue.push(pseudo);
    }

    return player;
  }

  disconnectPlayer(socketId: string): Player | undefined {
    const pseudo = this.socketToPlayer.get(socketId);
    if (!pseudo) return undefined;

    const player = this.playersByPseudo.get(pseudo);
    if (player) {
      player.isConnected = false;
      player.lastSeen = Date.now();
    }

    this.socketToPlayer.delete(socketId);
    return player;
  }

  // Betting
  placeBet(socketId: string, horseId: string, amount: number): Bet | null {
    if (this.state.isGamePaused || this.state.phase !== "BETTING") return null;

    const player = this.getPlayerBySocket(socketId);
    if (!player) return null;

    const horse = this.state.horses.find((h) => h.id === horseId);
    if (!horse) return null;

    const clampedAmount = Math.max(1, Math.min(5, Math.round(amount)));

    const bet: Bet = {
      playerId: player.id,
      horseId,
      amount: clampedAmount,
    };

    player.currentBet = bet;
    player.lastBetAt = Date.now();
    return bet;
  }

  // Phase transitions
  startBetting(): void {
    this.purgeInactivePlayers();
    this.state.raceNumber++;
    this.state.phase = "BETTING";
    this.state.phaseStartedAt = Date.now();
    this.state.phaseDuration = PHASE_DURATIONS.BETTING;
    this.state.activeEvent = null;
    this.state.lightningEvent = null;
    this.state.miniGame = null;
    this.state.executionEvent = null;
    this.state.lastRaceWinner = null;
    this.state.roundDrinks = [];
    this.state.raceProgress = 0;
    this.pendingDrinkNotices.clear();

    // Pick one random name per sip tier [1, 2, 3, 5, 7]
    const names = horseNamesBySips as Record<string, string[]>;
    this.state.horses = SIPS_ODDS.map((sips, i) => {
      const pool = names[String(sips)] ?? ['???'];
      const name = pool[Math.floor(Math.random() * pool.length)];
      return {
        id: uuid(),
        name,
        speed: 0,
        endurance: 0,
        odds: sips,
        position: 0,
        lane: i,
        isEliminated: false,
        color: HORSE_COLORS[i],
        effectiveSpeed: 0,
        appearance: 'HORSE',
        isGolden: false,
        isDiamond: false,
        isBlackKnight: false,
        isAdrien: false,
        jockeyFallen: false,
        miniGameJockeyFallen: false,
        isReversed: false,
        isStruckByLightning: false,
      };
    });

    // Clear bets
    for (const player of this.playersByPseudo.values()) {
      player.currentBet = null;
      player.miniGameEliminated = false;
      player.blackKnightKillsUsed = 0;
      player.blackKnightLastKillAt = 0;
    }

    // Move queue players to active
    this.promoteFromQueue();
  }

  startRacing(): void {
    this.state.phase = "RACING";
    this.state.phaseStartedAt = Date.now();
    this.state.phaseDuration = PHASE_DURATIONS.RACING;

    this.raceTick = 0;
    this.horseRaceStates.clear();

    this.state.racePaused = false;
    this.state.raceProgress = 0;
    this.state.lightningEvent = null;
    this.state.miniGame = null;
    this.state.executionEvent = null;

    // Pre-determine finishing order (weighted by sip odds)
    this.finishOrder = this.rollFinishOrder(this.state.horses);
    const finishOrder = this.finishOrder;

    // DEBUG: log scripted finish order
    console.log('🏇 SCRIPTED FINISH ORDER:');
    finishOrder.forEach((id, rank) => {
      const h = this.state.horses.find((x) => x.id === id);
      if (h) console.log(`  ${rank + 1}. ${h.name} (${h.odds}G)`);
    });

    for (const horse of this.state.horses) {
      horse.position = 0;
      horse.effectiveSpeed = 3;
      horse.jockeyFallen = false;
      horse.miniGameJockeyFallen = false;
      horse.isReversed = false;
      horse.isStruckByLightning = false;
      horse.isEliminated = false;

      // Every roll is per horse. Camel and motorcycle are independent rolls;
      // in the exceptionally rare double hit, the motorcycle wins visually.
      const camel = Math.random() < 1 / RACE_EVENT_ODDS.CAMEL;
      const motorcycle = Math.random() < 1 / RACE_EVENT_ODDS.MOTORCYCLE;
      horse.appearance = motorcycle ? 'MOTORCYCLE' : camel ? 'CAMEL' : 'HORSE';
      horse.isGolden = Math.random() < 1 / RACE_EVENT_ODDS.GOLDEN;
      horse.isDiamond = Math.random() < 1 / RACE_EVENT_ODDS.DIAMOND;
      horse.isBlackKnight = Math.random() < 1 / 35;
      horse.isAdrien = Math.random() < 1 / RACE_EVENT_ODDS.ADRIEN;
      if (horse.isAdrien) horse.appearance = 'SCOOTER';

      const rank = finishOrder.indexOf(horse.id);
      const target = FINISH_POSITIONS[rank];

      // Random waves are texture only — the lead story is choreographed
      // below. Derivative budget stays well below base speed (no stalls).
      const budget = target * 0.35;
      const f1 = 1.2 + Math.random() * 1.0; // slow storyline wave
      const f2 = 2.6 + Math.random() * 1.4; // quicker surges
      const waves: Wave[] = [
        {
          amp: ((0.35 + Math.random() * 0.3) * budget * 0.55) / (2 * Math.PI * f1),
          freq: f1,
          phase: Math.random() * Math.PI * 2,
        },
        {
          amp: ((0.3 + Math.random() * 0.3) * budget * 0.3) / (2 * Math.PI * f2),
          freq: f2,
          phase: Math.random() * Math.PI * 2,
        },
      ];

      this.horseRaceStates.set(horse.id, {
        finishRank: rank,
        targetFinishPos: target,
        anchorPos: 0,
        anchorProgress: 0,
        waves,
        leadActs: [],
        gateBurst: Math.random() * 1.4,
        prevPos: 0,
        jockeyFallTick: Math.random() < 1 / RACE_EVENT_ODDS.JOCKEY_FALL ? 60 + Math.floor(Math.random() * 430) : null,
        jockeyBoostStartTick: null,
        reverseTick: Math.random() < 1 / RACE_EVENT_ODDS.REVERSE ? 90 + Math.floor(Math.random() * 390) : null,
        boostBonus: 0,
      });
    }

    // ── Choreograph the lead story ──
    // 2-3 acts across [0.08, 0.72]: each act, one horse surges ~1.5 units
    // above the winner's base line, holds, then fades. Guaranteed lead
    // changes, and nobody ever runs away with the race. The scripted winner
    // never holds the last act — it must come back in the finale.
    const actCount = 2 + Math.floor(Math.random() * 2);
    const pool = [...finishOrder];
    const seq: string[] = [];
    for (let i = 0; i < actCount; i++) {
      let pick: string;
      do {
        pick = pool[Math.floor(Math.random() * pool.length)];
      } while (
        pick === seq[seq.length - 1] || // no back-to-back repeat
        (i === actCount - 1 && pick === finishOrder[0]) // finale twist
      );
      seq.push(pick);
    }
    const span = 0.72 - 0.08;
    seq.forEach((id, i) => {
      const rs = this.horseRaceStates.get(id);
      if (!rs) return;
      const a = 0.08 + (span * i) / actCount + Math.random() * 0.04;
      const b = 0.08 + (span * (i + 1)) / actCount;
      const mid = (a + b) / 2;
      // enough to clear the winner's base line at the act's peak (gaps are
      // now cubic, so mid-race the whole field is within ~2 units anyway)
      const amp = (100 - rs.targetFinishPos) * mid ** 3 + 1.2 + Math.random() * 1.2;
      // fade slowly enough that base speed always wins: |dAct/dp| < 0.55·speed
      const halfDown = Math.max(b - mid + 0.1, (amp * 1.5) / (0.55 * rs.targetFinishPos));
      rs.leadActs.push({ mid, halfUp: Math.max(0.09, mid - a), halfDown, amp });
    });
  }

  /**
   * Planned base position before wiggle. The gap to the winner's line grows
   * as p³: the whole field stays glued together for three quarters of the
   * race, then fans out to the scripted finish in the home stretch — that's
   * where the race "opens up", like the real thing.
   */
  private baseCurve(target: number, p: number): number {
    return 100 * p - (100 - target) * p * p * p;
  }

  private basePos(rs: HorseRaceState, p: number): number {
    const c = this.baseCurve(rs.targetFinishPos, p);
    const cAnchor = this.baseCurve(rs.targetFinishPos, rs.anchorProgress);
    const cEnd = this.baseCurve(rs.targetFinishPos, 1); // = target
    const denom = Math.max(0.0001, cEnd - cAnchor);
    // rescale the remaining curve so it starts at the anchor and still lands
    // exactly on the scripted finish (anchors move on elimination re-ranks)
    return rs.anchorPos + ((c - cAnchor) / denom) * (rs.targetFinishPos - rs.anchorPos);
  }

  tickRace(): Horse | null {
    if (this.state.isGamePaused || this.state.racePaused) return null;

    this.raceTick++;
    const p = Math.min(1, this.raceTick / RACE_TICKS);
    this.state.raceProgress = p * 100;
    let winner: Horse | null = null;

    const leaderId = this.finishOrder[0];
    const leaderRs = leaderId ? this.horseRaceStates.get(leaderId) : undefined;
    const avgDelta = 100 / RACE_TICKS;

    // Timed individual incidents are rolled once at the gate, independently
    // for every runner, then revealed at their scheduled race tick.
    for (const horse of this.state.horses) {
      const rs = this.horseRaceStates.get(horse.id);
      if (!rs || horse.isEliminated) continue;
      if (rs.jockeyFallTick === this.raceTick) {
        // Publish the fall and activate its boost in the same server tick, so
        // every snapshot observes both state changes at the same instant.
        horse.jockeyFallen = true;
        rs.jockeyBoostStartTick = this.raceTick;
      }
      if (rs.reverseTick === this.raceTick && !horse.isReversed && this.finishOrder.length > 1) {
        horse.isReversed = true;
        this.removeFromFinishOrderAndRerank(horse.id);
      }
    }

    for (const horse of this.state.horses) {
      if (horse.isEliminated) continue;
      if (horse.position >= 100) continue;

      const rs = this.horseRaceStates.get(horse.id);
      if (!rs) continue;

      if (horse.isReversed) {
        const pos = Math.max(0, rs.prevPos - avgDelta * 0.9);
        const delta = pos - rs.prevPos;
        rs.prevPos = pos;
        horse.position = pos;
        horse.effectiveSpeed = horse.effectiveSpeed * 0.82 + Math.abs(delta / avgDelta) * 4.2 * 0.18;
        continue;
      }

      const base = this.basePos(rs, p);

      // Windowed waves: silent at the gate, at the finish line, and right
      // after a re-rank (segment fade-in) so the plan never jumps.
      const span = Math.max(0.0001, 1 - rs.anchorProgress);
      const pp = Math.min(1, Math.max(0, (p - rs.anchorProgress) / span));
      const segFade = Math.min(1, pp * 4);
      const window = Math.sin(Math.PI * p) * segFade;
      let wiggle = 0;
      for (const w of rs.waves) {
        wiggle += w.amp * Math.sin(2 * Math.PI * w.freq * p + w.phase);
      }
      wiggle *= window;

      // Choreographed lead acts: rise, hold the front, fade back to script
      for (const act of rs.leadActs) {
        const v =
          p <= act.mid
            ? smooth01((p - (act.mid - act.halfUp)) / act.halfUp)
            : 1 - smooth01((p - act.mid) / act.halfDown);
        if (v > 0) wiggle += act.amp * v * segFade;
      }

      // Gate surge: quick jump out of the stalls that melts away by the wire
      wiggle += rs.gateBurst * (1 - Math.exp(-p * 22)) * (1 - p);

      // Photo-finish duel: the runner-up closes on the leader around 85%,
      // then the script settles it in the last strides.
      if (rs.finishRank === 1 && leaderRs) {
        const duelWindow = Math.sin(Math.PI * Math.min(1, Math.max(0, (p - 0.72) / 0.24)));
        const gap = this.basePos(leaderRs, p) - base;
        if (duelWindow > 0 && gap > 1.2) wiggle += (gap - 1.2) * duelWindow;
      }

      // V2.2 permanent boosts are integrated from the instant they apply.
      // The integrated bonus means an early fall is materially stronger.
      const permanentBoost =
        (horse.appearance === 'MOTORCYCLE' ? RACE_SPEED_BONUSES.MOTORCYCLE : 0) +
        (horse.isAdrien ? RACE_SPEED_BONUSES.ADRIEN : 0);
      // Integrate the jockey bonus only from its activation tick onward. It is
      // never applied as an absolute multiplier to distance already covered.
      const jockeyBonus = rs.jockeyBoostStartTick !== null && this.raceTick >= rs.jockeyBoostStartTick
        ? RACE_SPEED_BONUSES.JOCKEY_FALLEN
        : 0;
      if (jockeyBonus > 0 || permanentBoost > 0) {
        rs.boostBonus += avgDelta * (jockeyBonus + permanentBoost);
      }

      // Forward-only for regular runners; a boost can now break the script
      // and reach the line early, which is the intended gameplay advantage.
      const pos = Math.min(100, Math.max(rs.prevPos, base + wiggle + rs.boostBonus));
      const delta = pos - rs.prevPos;
      rs.prevPos = pos;
      horse.position = pos;

      // Gallop cadence for the clients, relative to the mean pace (1..8)
      const cadence = Math.max(0.8, Math.min(8, (delta / avgDelta) * 4.2));
      horse.effectiveSpeed = horse.effectiveSpeed * 0.85 + cadence * 0.15;

      if (horse.position >= 100 && !winner) {
        winner = horse;
      }
    }

    return winner;
  }

  private rollFinishOrder(horses: Horse[]): string[] {
    const remaining = [...horses];
    const order: string[] = [];

    while (remaining.length > 0) {
      const weights = remaining.map((h) => WIN_WEIGHTS[h.odds] ?? 10);
      const totalWeight = weights.reduce((a, b) => a + b, 0);

      let roll = Math.random() * totalWeight;
      let picked = 0;
      for (let i = 0; i < weights.length; i++) {
        roll -= weights[i];
        if (roll <= 0) { picked = i; break; }
      }

      order.push(remaining[picked].id);
      remaining.splice(picked, 1);
    }

    return order;
  }

  startResults(winnerHorse: Horse): {
    winnerId: string;
    sipsToDistribute: number;
    losers: Array<{ player: Player; sips: number }>;
  } {
    this.state.phase = "RESULTS";
    this.state.phaseStartedAt = Date.now();
    this.state.phaseDuration = PHASE_DURATIONS.RESULTS;
    this.state.lightningEvent = null;

    this.tourneeDistributed = false;

    const losers: Array<{ player: Player; sips: number }> = [];
    let winnerPlayer: Player | undefined;
    let sipsToDistribute = 0;

    for (const player of this.playersByPseudo.values()) {
      if (!player.currentBet) continue;

      if (player.currentBet.horseId === winnerHorse.id && !player.miniGameEliminated) {
        // A golden winner distributes triple the odds instead of double.
        sipsToDistribute = winnerHorse.odds * (winnerHorse.isDiamond ? 5 : winnerHorse.isGolden ? 3 : 2);
        player.totalSipsGiven += sipsToDistribute;
        winnerPlayer = player;
      } else {
        // Loser: drinks the odds of the horse they bet on
        const betHorse = this.state.horses.find(
          (h) => h.id === player.currentBet!.horseId,
        );
        const blackKnightBackfire = !!betHorse?.isBlackKnight;
        const sips = blackKnightBackfire
          ? player.currentBet.amount * 3
          : betHorse ? betHorse.odds : player.currentBet.amount;
        player.debt += sips;
        player.totalSipsDrunk += sips;
        losers.push({ player, sips });
      }
    }

    if (winnerPlayer) {
      this.state.lastRaceWinner = {
        pseudo: winnerPlayer.pseudo,
        horseName: winnerHorse.name,
        sipsToDistribute,
      };
    }

    this.state.roundDrinks = losers.map(({ player, sips }) => ({ pseudo: player.pseudo, sips }));

    // A completed race is a durable checkpoint for the whole evening.
    this.persistence.dump(this.getDumpData());

    return { winnerId: winnerHorse.id, sipsToDistribute, losers };
  }

  startIdle(): void {
    this.state.phase = "IDLE";
    this.state.phaseStartedAt = Date.now();
    this.state.phaseDuration = PHASE_DURATIONS.IDLE;
    this.state.activeEvent = null;
    this.state.lightningEvent = null;
    this.state.miniGame = null;
    this.state.executionEvent = null;
    this.state.racePaused = false;
    this.state.isRulesOpen = false;
    this.state.isGamePaused = false;
    this.state.pausedAt = null;
    this.state.pauseReason = null;

    // Mark all players as disconnected — they must re-join for the next race
    for (const player of this.playersByPseudo.values()) {
      player.isConnected = false;
      player.currentBet = null;
    }
  }

  /** Reset the IDLE countdown (e.g. when first player joins) */
  setIdleCountdown(durationMs: number): void {
    this.state.phaseStartedAt = Date.now();
    this.state.phaseDuration = durationMs;
  }

  setPhaseCountdown(durationMs: number): void {
    this.state.phaseStartedAt = Date.now();
    this.state.phaseDuration = durationMs;
  }

  // Events
  getActiveEvent(): GameEvent | null {
    return this.state.activeEvent;
  }

  setActiveEvent(event: GameEvent): void {
    this.state.activeEvent = event;
  }

  clearActiveEvent(): void {
    this.state.activeEvent = null;
  }

  // Race pause/resume
  pauseRace(): void {
    this.state.racePaused = true;
  }

  resumeRace(): void {
    this.state.racePaused = false;
  }

  isRacePaused(): boolean {
    return this.state.racePaused;
  }

  getRaceTick(): number {
    return this.raceTick;
  }

  getFinishOrder(): string[] {
    return this.finishOrder;
  }

  startLightning(): boolean {
    if (this.state.isGamePaused) return false;
    const candidates = this.finishOrder
      .map((id) => this.state.horses.find((horse) => horse.id === id))
      .filter((horse): horse is Horse => !!horse && !horse.isEliminated && !horse.isReversed);
    if (candidates.length < 2) return false;

    const damageRoll = Math.random();
    const requested = damageRoll < 0.67 ? 1 : damageRoll < 0.92 ? 2 : damageRoll < 0.97 ? 3 : 4;
    const count = Math.min(requested, candidates.length - 1);
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const startedAt = Date.now();
    this.state.lightningEvent = {
      id: uuid(),
      startedAt,
      strikeAt: startedAt + 3_500,
      clearAt: startedAt + 3_750,
      endsAt: startedAt + 6_750,
      targetHorseIds: shuffled.slice(0, count).map((horse) => horse.id),
      phase: 'BLACKOUT',
    };
    return true;
  }

  strikeLightning(): void {
    const lightning = this.state.lightningEvent;
    if (!lightning) return;
    lightning.phase = 'STRIKE';
    for (const horseId of lightning.targetHorseIds) {
      const horse = this.state.horses.find((candidate) => candidate.id === horseId);
      if (!horse || horse.isEliminated) continue;
      horse.isStruckByLightning = true;
      this.eliminateHorse(horseId);
    }
  }

  startLightningClearing(): void {
    if (this.state.lightningEvent) this.state.lightningEvent.phase = 'CLEARING';
  }

  clearLightning(): void {
    this.state.lightningEvent = null;
  }

  private removeFromFinishOrderAndRerank(horseId: string): void {
    this.finishOrder = this.finishOrder.filter((id) => id !== horseId);

    const progress = Math.min(1, this.raceTick / RACE_TICKS);
    for (let i = 0; i < this.finishOrder.length; i++) {
      const h = this.state.horses.find((candidate) => candidate.id === this.finishOrder[i]);
      const rs = this.horseRaceStates.get(this.finishOrder[i]);
      if (rs && h) {
        rs.finishRank = i;
        rs.targetFinishPos = FINISH_POSITIONS[i] ?? (100 - i * 10);
        rs.anchorPos = h.position;
        rs.anchorProgress = progress;
        rs.prevPos = h.position;
      }
    }
  }

  // Horse elimination + finish order recompute
  eliminateHorse(horseId: string): void {
    const horse = this.state.horses.find((h) => h.id === horseId);
    if (!horse || horse.isEliminated) return;

    // Always leave one finish-capable runner so a race cannot deadlock.
    if (this.finishOrder.includes(horseId) && this.finishOrder.length <= 1) return;

    horse.isEliminated = true;
    this.removeFromFinishOrderAndRerank(horseId);

    console.log('🚫 HORSE ELIMINATED:', horse.name);
    console.log('📋 NEW FINISH ORDER:');
    this.finishOrder.forEach((id, rank) => {
      const h = this.state.horses.find((x) => x.id === id);
      if (h) console.log(`  ${rank + 1}. ${h.name} (${h.odds}G)`);
    });
  }

  // Vote registration
  registerVote(
    eventId: string,
    playerId: string,
    valid: boolean,
  ): { majority: 'valid' | 'not_valid' | null; votes: Record<string, boolean> } | null {
    if (this.state.isGamePaused) return null;
    const event = this.state.activeEvent;
    if (!event || event.id !== eventId || event.resolved) return null;

    // Only non-affected players can vote
    if (!event.nonAffectedPlayerIds.includes(playerId)) return null;

    event.votes[playerId] = valid;

    // Check majority
    const totalVoters = event.nonAffectedPlayerIds.length;
    const majorityNeeded = Math.floor(totalVoters / 2) + 1;

    const validVotes = Object.values(event.votes).filter((v) => v === true).length;
    const invalidVotes = Object.values(event.votes).filter((v) => v === false).length;

    let majority: 'valid' | 'not_valid' | null = null;
    if (validVotes >= majorityNeeded) majority = 'valid';
    else if (invalidVotes >= majorityNeeded) majority = 'not_valid';

    return { majority, votes: { ...event.votes } };
  }

  // ── Winner's tournée: send the earned sips to chosen players ──
  private tourneeDistributed = false;

  /**
   * Validates and applies the winner's sip distribution. Returns the applied
   * targets (with socket ids) so the gateway can notify them, or null if the
   * request is invalid (wrong phase, not the winner, over budget, replay).
   */
  distributeSips(
    socketId: string,
    allocations: Array<{ pseudo: string; sips: number }>,
  ): Array<{ id: string; pseudo: string; sips: number }> | null {
    if (this.state.isGamePaused) return null;
    // Valid from the results screen until the next race's betting opens
    // (lastRaceWinner is cleared by startBetting) — no time pressure.
    if (this.state.phase !== "RESULTS" && this.state.phase !== "IDLE") return null;
    if (this.tourneeDistributed) return null;
    const winner = this.state.lastRaceWinner;
    if (!winner) return null;
    const sender = this.getPlayerBySocket(socketId);
    if (!sender || sender.pseudo !== winner.pseudo) return null;
    if (!Array.isArray(allocations) || allocations.length === 0) return null;

    let total = 0;
    const applied: Array<{ id: string; pseudo: string; sips: number }> = [];
    for (const a of allocations) {
      const sips = Math.round(a?.sips ?? 0);
      if (!a?.pseudo || sips <= 0) return null;
      if (a.pseudo === sender.pseudo) return null;
      // no isConnected check: IDLE flags everyone disconnected until they
      // re-join, but their sockets are still live and the debt must land
      const target = this.playersByPseudo.get(a.pseudo);
      if (!target) return null;
      total += sips;
      applied.push({ id: target.id, pseudo: target.pseudo, sips });
    }
    if (total > winner.sipsToDistribute) return null;

    for (const a of applied) {
      const target = this.playersByPseudo.get(a.pseudo);
      if (target) {
        target.debt += a.sips;
        target.totalSipsDrunk += a.sips;
      }
      const existing = this.state.roundDrinks.find((drink) => drink.pseudo === a.pseudo);
      if (existing) existing.sips += a.sips;
      else this.state.roundDrinks.push({ pseudo: a.pseudo, sips: a.sips });
    }
    this.tourneeDistributed = true;
    this.persistence.dump(this.getDumpData());
    return applied;
  }

  // Drink management
  confirmDrink(socketId: string): number {
    if (this.state.isGamePaused) return 0;
    const player = this.getPlayerBySocket(socketId);
    if (!player || player.debt <= 0) return 0;

    const confirmed = player.debt;
    player.debt = 0;
    this.pendingDrinkNotices.delete(player.pseudo);

    const timerKey = player.pseudo;
    const timer = this.drinkTimers.get(timerKey);
    if (timer) {
      if (timer.timeout) clearTimeout(timer.timeout);
      this.drinkTimers.delete(timerKey);
    }

    return confirmed;
  }

  startDrinkTimer(pseudo: string, onPenalty: () => void): void {
    const existing = this.drinkTimers.get(pseudo);
    if (existing?.timeout) clearTimeout(existing.timeout);

    const now = Date.now();
    const timer: PausableDrinkTimer = {
      timeout: null,
      dueAt: now + DRINK_CONFIRM_TIMEOUT_MS,
      remainingMs: DRINK_CONFIRM_TIMEOUT_MS,
      onPenalty,
    };
    this.drinkTimers.set(pseudo, timer);
    this.armDrinkTimer(pseudo, timer, now);
  }

  // Queue management
  private promoteFromQueue(): void {
    const active = this.getConnectedPlayers();
    while (this.state.queue.length > 0 && active.length < MAX_ACTIVE_PLAYERS) {
      const pseudo = this.state.queue.shift();
      if (pseudo) {
        const player = this.playersByPseudo.get(pseudo);
        if (player && player.isConnected) {
          active.push(player);
        }
      }
    }
  }

  // ── Défi mignon ──────────────────────────────────────────────────────────
  startMiniGame(type?: MiniGameType): MiniGameState | null {
    if (this.state.isGamePaused || this.state.phase !== 'RACING' || this.state.miniGame) return null;
    const participants = this.getConnectedPlayers().filter((player) => !!player.currentBet && !player.miniGameEliminated);
    if (participants.length < 2) return null;
    const picked = type ?? MINI_GAME_TYPES[Math.floor(Math.random() * MINI_GAME_TYPES.length)];
    const payload: Record<string, unknown> = {};
    let prompt = '';
    if (picked === 'GRID') {
      const values = Array.from({ length: 36 }, (_, index) => index + 1).sort(() => Math.random() - .5);
      const target = values[Math.floor(Math.random() * values.length)];
      Object.assign(payload, { values, target }); prompt = `Trouvez le ${target}`;
    } else if (picked === 'CODE') {
      const a = 1 + Math.floor(Math.random() * 12), b = 1 + Math.floor(Math.random() * 12);
      Object.assign(payload, { a, b, answer: a * b }); prompt = `${a} × ${b}`;
    } else if (picked === 'CAPITAL') {
      const roll = Math.random(), category = roll < .6 ? 0 : roll < .9 ? 1 : 2;
      const bank = CAPITALS[category], entry = bank[Math.floor(Math.random() * bank.length)];
      const wrong = bank.filter((candidate) => candidate[1] !== entry[1]).sort(() => Math.random() - .5).slice(0, 3).map((candidate) => candidate[1]);
      const choices = [entry[1], ...wrong].sort(() => Math.random() - .5);
      Object.assign(payload, { country: entry[0], answer: entry[1], choices }); prompt = `Capitale : ${entry[0]}`;
    } else if (picked === 'MAZE') {
      Object.assign(payload, { mazeIndex: Math.floor(Math.random() * MAZE_BANK_SIZE) }); prompt = 'Sortez du labyrinthe';
    } else if (picked === 'CLICKER') prompt = 'Cliquez le plus vite possible';
    else if (picked === 'ORDER') {
      Object.assign(payload, { values: Array.from({ length: 16 }, (_, index) => index + 1).sort(() => Math.random() - .5) }); prompt = '1 → 16';
    } else if (picked === 'PENALTY') prompt = '10 tirs — visez entre les poteaux';
    else prompt = 'Arrêtez la jauge au plus près de 100 %';

    const startedAt = Date.now();
    this.state.miniGame = {
      id: uuid(), type: picked, startedAt, endsAt: startedAt + MINI_GAME_DURATIONS[picked], status: 'PLAYING', resultsEndAt: null,
      prompt, payload,
      players: participants.map((player) => ({ playerId: player.id, pseudo: player.pseudo, score: 0, progress: 0, finishedAt: null, lives: 2, eliminated: false })),
    };
    this.pauseRace();
    return this.state.miniGame;
  }

  handleMiniGameAction(socketId: string, gameId: string, action: string, value?: number | string): boolean {
    if (this.state.isGamePaused) return false;
    return applyMiniGameAction(this.state.miniGame, socketId, gameId, action, value).accepted;
  }

  shouldEndMiniGameEarly(): boolean {
    return shouldEndMiniGameEarly(this.state.miniGame);
  }

  resolveMiniGame(): string[] {
    const game = this.state.miniGame;
    if (!game || game.status !== 'PLAYING') return [];
    const losers = resolveMiniGameState(game);
    for (const row of losers) {
      const player = this.getPlayerByPseudo(row.pseudo);
      if (!player?.currentBet) continue;
      player.miniGameEliminated = true;
      const bettors = this.getAllPlayers().filter((candidate) => !candidate.miniGameEliminated && candidate.currentBet?.horseId === player.currentBet!.horseId);
      if (bettors.length === 0) this.eliminateHorse(player.currentBet.horseId);
      else {
        const horse = this.state.horses.find((candidate) => candidate.id === player.currentBet!.horseId);
        if (horse) horse.miniGameJockeyFallen = true;
      }
    }
    return losers.map((row) => row.playerId);
  }

  clearMiniGame(): void { this.state.miniGame = null; this.resumeRace(); }

  useBlackKnightPower(socketId: string, targetHorseId: string): { targetIds: string[]; affectedPlayerIds: string[] } | null {
    if (this.state.isGamePaused || this.state.phase !== 'RACING' || this.state.racePaused) return null;
    const player = this.getPlayerBySocket(socketId);
    const knight = player?.currentBet ? this.state.horses.find((horse) => horse.id === player.currentBet!.horseId) : undefined;
    const target = this.state.horses.find((horse) => horse.id === targetHorseId);
    if (!player || !knight?.isBlackKnight || !target || target.id === knight.id || target.isEliminated || player.blackKnightKillsUsed >= 2) return null;
    if (Date.now() - player.blackKnightLastKillAt < BLACK_KNIGHT_KILL_COOLDOWN_MS) return null;
    player.blackKnightKillsUsed++; player.blackKnightLastKillAt = Date.now();
    const affectedPlayerIds = this.getConnectedPlayers()
      .filter((candidate) => candidate.currentBet?.horseId === target.id)
      .map((candidate) => candidate.id);
    this.execution(target.id, knight.id);
    return { targetIds: [target.id], affectedPlayerIds };
  }

  autoBlackKnightKill(): { affectedPlayerIds: string[] } | null {
    const knight = this.state.horses.find((horse) => horse.isBlackKnight && !horse.isEliminated);
    if (!knight || this.getAllPlayers().some((player) => player.currentBet?.horseId === knight.id)) return null;
    const target = this.state.horses.filter((horse) => !horse.isEliminated && horse.id !== knight.id).sort(() => Math.random() - .5)[0];
    if (!target) return null;
    const affectedPlayerIds = this.getConnectedPlayers()
      .filter((candidate) => candidate.currentBet?.horseId === target.id)
      .map((candidate) => candidate.id);
    this.execution(target.id, knight.id);
    return { affectedPlayerIds };
  }

  private execution(targetHorseId: string, attackerHorseId: string) {
    const startedAt = Date.now();
    this.state.executionEvent = { id: uuid(), attackerHorseId, targetHorseId, startedAt, endsAt: startedAt + 3_000 };
    this.eliminateHorse(targetHorseId);
  }

  clearExecution(): void { this.state.executionEvent = null; }

  purgeInactivePlayers(now = Date.now()): string[] {
    const removed: string[] = [];
    for (const [pseudo, player] of this.playersByPseudo) {
      if (now - player.lastBetAt < PLAYER_INACTIVITY_MS) continue;
      if (player.id) this.kickedSocketIds.push(player.id);
      removed.push(pseudo); this.playersByPseudo.delete(pseudo); this.state.queue = this.state.queue.filter((name) => name !== pseudo);
      for (const [socket, mapped] of this.socketToPlayer) if (mapped === pseudo) this.socketToPlayer.delete(socket);
    }
    return removed;
  }

  consumeKickedSocketIds(): string[] { return this.kickedSocketIds.splice(0); }

  resetSession(): void {
    for (const timer of this.drinkTimers.values()) if (timer.timeout) clearTimeout(timer.timeout);
    this.drinkTimers.clear(); this.pendingDrinkNotices.clear(); this.playersByPseudo.clear(); this.socketToPlayer.clear();
    this.state.players = []; this.state.eveningLeaderboard = []; this.state.roundDrinks = []; this.state.queue = []; this.state.lastRaceWinner = null; this.state.raceNumber = 0;
    this.persistence.dump(this.getDumpData());
  }

  // Persistence
  getDumpData() {
    return {
      players: Array.from(this.playersByPseudo.values()).map((p) => ({
        pseudo: p.pseudo,
        totalSipsGiven: p.totalSipsGiven,
        totalSipsDrunk: p.totalSipsDrunk,
        debt: p.debt,
        lastBetAt: p.lastBetAt,
      })),
      raceNumber: this.state.raceNumber,
      dumpedAt: Date.now(),
    };
  }
}
