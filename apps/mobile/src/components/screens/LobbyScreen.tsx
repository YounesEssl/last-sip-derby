'use client'

import type { GameState, Player } from '@last-sip-derby/shared'
import { Header, CountdownPill, usePhaseCountdown } from '../ui'

export function LobbyScreen({ state, player, pseudo }: { state: GameState; player: Player | null; pseudo: string }) {
  const seconds = usePhaseCountdown(state.phaseStartedAt, state.phaseDuration, state.serverNow)

  return (
    <div className="flex h-full flex-col">
      <Header raceNumber={state.raceNumber + 1} right={<CountdownPill seconds={seconds} label="PARIS DANS" />} />

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
        <div className="paper ticket-edge w-full max-w-sm rounded-lg px-6 py-6 text-center animate-rise">
          <div className="font-headline text-lg tracking-[0.3em] text-derby-coal">CARTE DE MEMBRE</div>
          <div className="mt-2 font-display text-4xl text-derby-red">{pseudo}</div>
          <div className="mx-auto mt-3 w-fit rotate-[-4deg] border-4 border-derby-green px-4 py-1 font-headline text-xl tracking-[0.2em] text-derby-green">
            ADMIS EN TRIBUNE
          </div>
          {player && (
            <div className="mt-4 flex justify-center gap-6 border-t-2 border-dashed border-derby-coal/30 pt-3 font-mono text-sm text-derby-coal">
              <span>
                🍺 bues : <b>{player.totalSipsDrunk}</b>
              </span>
              <span>
                🎁 offertes : <b>{player.totalSipsGiven}</b>
              </span>
            </div>
          )}
        </div>

        <div className="text-center font-body text-derby-smoke animate-rise" style={{ animationDelay: '0.15s' }}>
          <p className="text-lg">Regarde le grand écran 📺</p>
          <p className="mt-1 text-sm">Les paris ouvrent dans {seconds}s. Garde ton verre à portée de main.</p>
        </div>

        <div className="font-mono text-xs text-derby-smoke/60">
          {state.players.length} turfiste{state.players.length > 1 ? 's' : ''} dans les tribunes
        </div>
      </div>
    </div>
  )
}
