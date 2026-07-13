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
  reverseTick: number | null;
  boostBonus: number;
}

function smooth01(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

@Injectable()
export class GameService implements OnModuleInit {
  private state: GameState = {
    serverNow: Date.now(),
    phase: "IDLE",
    raceNumber: 0,
    horses: [],
    players: [],
    eveningLeaderboard: [],
    roundDrinks: [],
    queue: [],
    activeEvent: null,
    lightningEvent: null,
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
    this.state.serverNow = Date.now();
    this.state.players = this.getConnectedPlayers();
    this.state.eveningLeaderboard = Array.from(this.playersByPseudo.values())
      .sort((a, b) => b.totalSipsDrunk - a.totalSipsDrunk)
      .map((player) => ({ ...player, currentBet: null, id: "", isConnected: false }));
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
    this.state.lightningEvent = null;
    this.state.lastRaceWinner = null;
    this.state.roundDrinks = [];
    this.state.raceProgress = 0;

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
        jockeyFallen: false,
        isReversed: false,
        isStruckByLightning: false,
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
    this.state.raceProgress = 0;
    this.state.lightningEvent = null;

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
      horse.isReversed = false;
      horse.isStruckByLightning = false;
      horse.isEliminated = false;

      // Every roll is per horse. Camel and motorcycle are independent rolls;
      // in the exceptionally rare double hit, the motorcycle wins visually.
      const camel = Math.random() < 1 / 25;
      const motorcycle = Math.random() < 1 / 30;
      horse.appearance = motorcycle ? 'MOTORCYCLE' : camel ? 'CAMEL' : 'HORSE';
      horse.isGolden = Math.random() < 1 / 15;

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
        jockeyFallTick: Math.random() < 1 / 25 ? 60 + Math.floor(Math.random() * 430) : null,
        reverseTick: Math.random() < 1 / 30 ? 90 + Math.floor(Math.random() * 390) : null,
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
    if (this.state.racePaused) return null;

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
      if (rs.jockeyFallTick === this.raceTick) horse.jockeyFallen = true;
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

      // A riderless horse runs 15% faster from the instant the jockey drops.
      // The integrated bonus means an early fall is materially stronger.
      if (horse.jockeyFallen) rs.boostBonus += avgDelta * 0.15;

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

      if (player.currentBet.horseId === winnerHorse.id) {
        // A golden winner distributes triple the odds instead of double.
        sipsToDistribute = winnerHorse.odds * (winnerHorse.isGolden ? 3 : 2);
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

  startLightning(): boolean {
    const candidates = this.finishOrder
      .map((id) => this.state.horses.find((horse) => horse.id === id))
      .filter((horse): horse is Horse => !!horse && !horse.isEliminated && !horse.isReversed);
    if (candidates.length < 2) return false;

    const damageRoll = Math.random();
    const requested = damageRoll < 0.65 ? 1 : damageRoll < 0.9 ? 2 : 3;
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
