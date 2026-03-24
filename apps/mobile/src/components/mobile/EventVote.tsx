'use client'

import type { GameEvent } from '@last-sip-derby/shared'

interface EventVoteProps {
  event: GameEvent
  onVote: (eventId: string, valid: boolean) => void
}

export function EventVote({ event, onVote }: EventVoteProps) {
  return (
    <div className="min-h-screen bg-pmu-dark flex flex-col items-center justify-center p-6 text-center">
      {/* Title */}
      <h1 className="font-display text-4xl text-pmu-alert mb-4 uppercase">
        {event.title}
      </h1>

      {/* Description */}
      <p className="text-xl text-white/80 font-body mb-6 leading-relaxed max-w-sm">
        {event.description}
      </p>

      {/* Sips info */}
      <div className="text-2xl font-bold text-red-400 mb-2">
        {event.targetHorseName} doit boire {event.sipsAmount} gorgee{event.sipsAmount > 1 ? 's' : ''} !
      </div>

      <p className="text-lg text-white/50 font-body mb-8">
        Est-ce que les parieurs ont bu ?
      </p>

      {/* Vote buttons */}
      <div className="flex gap-4 w-full max-w-sm">
        <button
          onClick={() => onVote(event.id, true)}
          className="flex-1 py-6 bg-green-700 text-white font-display text-2xl uppercase border-4 border-green-400 active:bg-green-800 transition-colors"
          style={{ boxShadow: '4px 4px 0px #1a4d1a' }}
        >
          VALIDE
        </button>
        <button
          onClick={() => onVote(event.id, false)}
          className="flex-1 py-6 bg-red-700 text-white font-display text-2xl uppercase border-4 border-red-400 active:bg-red-800 transition-colors"
          style={{ boxShadow: '4px 4px 0px #4d1a1a' }}
        >
          PAS VALIDE
        </button>
      </div>

      {/* Vote progress */}
      <div className="mt-6 text-sm text-white/40 font-mono">
        Votes: {Object.keys(event.votes).length} / {event.nonAffectedPlayerIds.length}
      </div>
    </div>
  )
}
