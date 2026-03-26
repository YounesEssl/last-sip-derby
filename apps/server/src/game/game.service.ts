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
} from "@last-sip-derby/shared";
import { PersistenceService } from "../persistence/persistence.service";

// ── Simple 1D value noise for smooth speed waves (replaces Math.random jitter) ──
class ValueNoise {
  private perm: number[];
  constructor(seed: number) {
    this.perm = Array.from({ length: 256 }, (_, i) => i);
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const j = s % (i + 1);
      [this.perm[i], this.perm[j]] = [this.perm[j], this.perm[i]];
    }
  }
  sample(x: number): number {
    const xi = Math.floor(x) & 255;
    const xf = x - Math.floor(x);
    const u = xf * xf * (3 - 2 * xf);
    const a = this.perm[xi] / 255;
    const b = this.perm[(xi + 1) & 255] / 255;
    return a + u * (b - a); // 0–1
  }
}

// ── Scripted race: outcome decided before the race, animation is pure spectacle ──
const SIPS_ODDS = [1, 2, 3, 5, 7] as const;
const RACE_TICKS = 700; // ~70s race
const FINISH_POSITIONS = [100, 93, 84, 72, 58]; // winner → last place

// Win probability weights per sip value
const WIN_WEIGHTS: Record<number, number> = { 1: 35, 2: 25, 3: 18, 5: 13, 7: 8 };

interface HorseRaceState {
  finishRank: number;       // 0=winner, 4=last (pre-determined)
  targetFinishPos: number;  // from FINISH_POSITIONS
  noise: ValueNoise;        // slow surges (~6s waves)
  fastNoise: ValueNoise;    // quick bursts (~2s waves)
  startBurst: number;       // random chaos magnitude for first 10s
}

@Injectable()
export class GameService implements OnModuleInit {
  private state: GameState = {
    phase: "IDLE",
    raceNumber: 0,
    horses: [],
    players: [],
    queue: [],
    activeEvent: null,
    racePaused: false,
    raceProgress: 0,
    phaseStartedAt: Date.now(),
    phaseDuration: PHASE_DURATIONS.IDLE,
    lastRaceWinner: null,
  };

  private playersByPseudo: Map<string, Player> = new Map();
  private socketToPlayer: Map<string, string> = new Map(); // socketId -> pseudo
  private drinkTimers: Map<string, NodeJS.Timeout> = new Map();

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
    this.state.players = this.getConnectedPlayers();
    return { ...this.state };
  }

  getPhase(): GamePhase {
    return this.state.phase;
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

  hasConnectedPlayers(): boolean {
    return Array.from(this.playersByPseudo.values()).some((p) => p.isConnected);
  }

  // Player management
  joinPlayer(socketId: string, pseudo: string): Player {
    const existing = this.playersByPseudo.get(pseudo);
    if (existing) {
      // Reconnection
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
    if (this.state.phase !== "BETTING") return null;

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
    return bet;
  }

  // Phase transitions
  startBetting(): void {
    this.state.raceNumber++;
    this.state.phase = "BETTING";
    this.state.phaseStartedAt = Date.now();
    this.state.phaseDuration = PHASE_DURATIONS.BETTING;
    this.state.activeEvent = null;
    this.state.lastRaceWinner = null;

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
      };
    });

    // Clear bets
    for (const player of this.playersByPseudo.values()) {
      player.currentBet = null;
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
      horse.effectiveSpeed = 0;

      const rank = finishOrder.indexOf(horse.id);

      this.horseRaceStates.set(horse.id, {
        finishRank: rank,
        targetFinishPos: FINISH_POSITIONS[rank],
        noise: new ValueNoise(Math.floor(Math.random() * 100000)),
        fastNoise: new ValueNoise(Math.floor(Math.random() * 100000)),
        startBurst: 0.1 + Math.random() * 3.5,
      });
    }
  }

  tickRace(): Horse | null {
    if (this.state.racePaused) return null;

    this.raceTick++;
    const progress = Math.min(1, this.raceTick / RACE_TICKS);
    this.state.raceProgress = progress * 100;
    let winner: Horse | null = null;

    // Safety: no one finishes before 65% of the race
    const maxPos = progress < 0.65 ? 93 : 100;

    for (const horse of this.state.horses) {
      if (horse.isEliminated) continue;
      if (horse.position >= 100) continue;

      const rs = this.horseRaceStates.get(horse.id);
      if (!rs) continue;

      const targetSpeed = rs.targetFinishPos / RACE_TICKS;

      // ── 1. Speed noise: MASSIVE variation, two layers ──
      // Full chaos until 50%, then fades fast so correction takes over
      const noiseFade = progress < 0.50
        ? 1.0
        : Math.max(0.01, 1 - (progress - 0.50) / 0.25);
      const slow = (rs.noise.sample(this.raceTick * 0.012) - 0.5) * 2;     // ~8s waves
      const fast = (rs.fastNoise.sample(this.raceTick * 0.055) - 0.5) * 2;  // ~2s bursts
      const noiseVal = slow * 0.65 + fast * 0.35;
      const speedMult = Math.max(0, 1 + noiseVal * 0.95 * noiseFade);

      // ── 2. Base noise speed ──
      let speed = targetSpeed * speedMult;

      // ── 3. Correction: ADDITIVE force starting at 45% ──
      // Pushes horse toward scripted position regardless of noise
      if (progress > 0.45) {
        const targetPos = rs.targetFinishPos * progress;
        const error = targetPos - horse.position;
        const blend = Math.pow((progress - 0.45) / 0.55, 2);
        speed += error * blend * 0.25;
      }

      // ── 4. Apply speed (never negative) ──
      horse.position = Math.min(maxPos, horse.position + Math.max(0, speed));

      // ── 4. Chaotic start: HUGE forward bursts (first 15s) ──
      if (this.raceTick < 150) {
        const fade = 1 - this.raceTick / 150;
        const burst = Math.random() * 0.6 * fade * rs.startBurst;
        horse.position = Math.min(maxPos, horse.position + burst);
      }

      // ── Effective speed for gallop animation (smoothed to avoid jitter) ──
      const rawAnimSpeed = Math.max(1, Math.min(10, (speed / targetSpeed) * 5));
      horse.effectiveSpeed = horse.effectiveSpeed * 0.8 + rawAnimSpeed * 0.2;

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

    const losers: Array<{ player: Player; sips: number }> = [];
    let winnerPlayer: Player | undefined;
    let sipsToDistribute = 0;

    for (const player of this.playersByPseudo.values()) {
      if (!player.currentBet) continue;

      if (player.currentBet.horseId === winnerHorse.id) {
        // Winner: distributes double the horse's odds
        sipsToDistribute = winnerHorse.odds * 2;
        player.totalSipsGiven += sipsToDistribute;
        winnerPlayer = player;
      } else {
        // Loser: drinks the odds of the horse they bet on
        const betHorse = this.state.horses.find(
          (h) => h.id === player.currentBet!.horseId,
        );
        const sips = betHorse ? betHorse.odds : player.currentBet.amount;
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

    return { winnerId: winnerHorse.id, sipsToDistribute, losers };
  }

  startIdle(): void {
    this.state.phase = "IDLE";
    this.state.phaseStartedAt = Date.now();
    this.state.phaseDuration = PHASE_DURATIONS.IDLE;
    this.state.activeEvent = null;
    this.state.racePaused = false;

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

  // Horse elimination + finish order recompute
  eliminateHorse(horseId: string): void {
    const horse = this.state.horses.find((h) => h.id === horseId);
    if (!horse) return;

    horse.isEliminated = true;

    // Remove from finish order and recompute ranks
    this.finishOrder = this.finishOrder.filter((id) => id !== horseId);

    // Reassign ranks and target positions for remaining horses
    const activeCount = this.finishOrder.length;
    for (let i = 0; i < activeCount; i++) {
      const rs = this.horseRaceStates.get(this.finishOrder[i]);
      if (rs) {
        rs.finishRank = i;
        rs.targetFinishPos = FINISH_POSITIONS[i] ?? (100 - i * 10);
      }
    }

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

  // Drink management
  confirmDrink(socketId: string): number {
    const player = this.getPlayerBySocket(socketId);
    if (!player || player.debt <= 0) return 0;

    const confirmed = player.debt;
    player.debt = 0;

    const timerKey = player.pseudo;
    const timer = this.drinkTimers.get(timerKey);
    if (timer) {
      clearTimeout(timer);
      this.drinkTimers.delete(timerKey);
    }

    return confirmed;
  }

  startDrinkTimer(pseudo: string, onPenalty: () => void): void {
    const existing = this.drinkTimers.get(pseudo);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      const player = this.playersByPseudo.get(pseudo);
      if (player && player.debt > 0) {
        player.debt += DRINK_PENALTY_SIPS;
        onPenalty();
      }
      this.drinkTimers.delete(pseudo);
    }, DRINK_CONFIRM_TIMEOUT_MS);

    this.drinkTimers.set(pseudo, timer);
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

  // Persistence
  getDumpData() {
    return {
      players: Array.from(this.playersByPseudo.values()).map((p) => ({
        pseudo: p.pseudo,
        totalSipsGiven: p.totalSipsGiven,
        totalSipsDrunk: p.totalSipsDrunk,
        debt: p.debt,
      })),
      raceNumber: this.state.raceNumber,
      dumpedAt: Date.now(),
    };
  }
}
