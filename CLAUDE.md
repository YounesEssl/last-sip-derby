# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start all apps concurrently (server :3001, tv :3000, mobile :3002)
pnpm build        # Build all apps (turbo handles dependency order)
pnpm type-check   # Type-check all apps and packages

# Single app dev
pnpm --filter server dev
pnpm --filter tv dev
pnpm --filter mobile dev

# Build shared package (must be done before apps if types changed)
pnpm --filter @last-sip-derby/shared build
```

No test framework is configured yet. No linter is configured.

## Architecture

**Monorepo** using pnpm workspaces + Turborepo with three apps and one shared package.

### Apps

- **`apps/server`** — NestJS backend (port 3001). Runs the game loop, manages state in-memory, communicates via Socket.io WebSockets. Key files: `src/game/game.gateway.ts` (WebSocket handlers), `src/game/game.service.ts` (state & logic), `src/game/game.loop.ts` (tick loop & phase transitions), `src/game/game.events.ts` (random race events). State persists to `state-dump.json` via `persistence.service.ts`.

- **`apps/tv`** — Next.js 14 App Router (port 3000). Large display meant for a TV/projector. Shows race track, odds board, QR code to join, scoreboard. Uses Framer Motion + GSAP for animations. Phase screens live in `src/components/tv/`. Hook: `useGameSocket` subscribes to server state.

- **`apps/mobile`** — Next.js 14 App Router (port 3002). Phone UI for players. Join game, place bets, tap-boost during races, drink notifications. Components in `src/components/mobile/`. Hook: `usePlayerSocket` manages connection and player state. Uses `nosleep.js` to keep screen awake.

### Shared Package

`packages/shared` — TypeScript types, constants, and horse data exported from `src/index.ts`. Compiled with `tsc` to CommonJS in `dist/`. Both Next.js apps transpile it via `transpilePackages: ['@last-sip-derby/shared']`.

### Communication Flow

All real-time communication uses Socket.io. Event types are defined in `packages/shared/src/types.ts` as `ServerToClientEvents` and `ClientToServerEvents`. The server broadcasts `game:stateUpdate` with full `GameState` on every tick. Clients send actions like `player:join`, `player:bet`, `player:tapBoost`.

### Game Phases

`IDLE` (30s) → `BETTING` (60s) → `RACING` (120s) → `RESULTS` (30s) → loop. Durations configured in `packages/shared/src/constants.ts`.

## Styling

Both frontends use Tailwind CSS with a shared retro-saloon theme. Custom colors are prefixed `pmu-` (e.g., `pmu-bg`, `pmu-wood`, `pmu-paper`, `pmu-alert`). Custom font families: `display` (Rye), `terminal` (VT323), `body` (Courier Prime). Defined in each app's `tailwind.config.ts`.
