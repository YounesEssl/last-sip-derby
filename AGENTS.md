# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

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

- **`apps/tv`** — Next.js 14 App Router (port 3000). Large display meant for a TV/projector. Phase screens live in `src/components/screens/` (Idle, Betting, Race, Results), routed by `src/app/page.tsx` (which holds the race view ~5s after the finish for the photo-finish celebration). The race itself is rendered by a custom canvas-2D engine in `src/race/` (`engine.ts` orchestrates; `horse.ts` procedural galloping horses; `scenery.ts` parallax background/crowd; `track.ts` dirt/markers/finish; `interpolator.ts` smooths 10 Hz server snapshots to 60 fps; `particles.ts` dust/confetti). HUD overlays (ranking, minimap, event banner) are DOM with Framer Motion. Hook: `useGameSocket` subscribes to server state. Dev shortcuts on the TV page: press `s` = force race start, `r` = reset.

- **`apps/mobile`** — Next.js 14 App Router (port 3002). Phone UI for players. Join, bet, watch a live mini-race preview (`src/components/MiniRace.tsx`, canvas), drink notifications and event votes (`src/components/Overlays.tsx`). Screens in `src/components/screens/`. Hook: `usePlayerSocket` manages connection and player state (auto-rejoins with the saved pseudo at IDLE/BETTING). Uses `nosleep.js` to keep screen awake.

### Shared Package

`packages/shared` — TypeScript types, constants, and horse data exported from `src/index.ts`. Compiled with `tsc` to CommonJS in `dist/`. Both Next.js apps transpile it via `transpilePackages: ['@last-sip-derby/shared']`.

### Communication Flow

All real-time communication uses Socket.io. Event types are defined in `packages/shared/src/types.ts` as `ServerToClientEvents` and `ClientToServerEvents`. The server broadcasts `game:stateUpdate` with full `GameState` on every tick. Clients send actions like `player:join`, `player:bet`, `player:vote`, `player:confirmDrink`.

### Game Phases

`IDLE` (30s) → `BETTING` (60s) → `RACING` (120s) → `RESULTS` (30s) → loop. Durations configured in `packages/shared/src/constants.ts`.

## Styling

Both frontends use Tailwind CSS with a shared vintage-hippodrome theme (dusk gold / cream paper / racing red / turf green). Custom colors are prefixed `derby-` (e.g., `derby-night`, `derby-cream`, `derby-gold`, `derby-red`, `derby-felt`). Font families: `display` (Rye), `headline` (Bebas Neue), `terminal` (VT323), `body` (Courier Prime), plus `mono` (DM Mono, TV only). Shared CSS utilities in each app's `globals.css`: `.paper` (betting-slip card), `.panel-gold`, `.text-engraved`; TV adds `.grain`/`.tv-frame` film treatment, mobile adds `.ticket-edge` perforations and `.btn-big`. Defined in each app's `tailwind.config.ts`.
