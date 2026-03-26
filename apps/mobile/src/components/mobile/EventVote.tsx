'use client'

import type { GameEvent } from '@last-sip-derby/shared'

interface EventVoteProps {
  event: GameEvent
  onVote: (eventId: string, valid: boolean) => void
}

export function EventVote({ event, onVote }: EventVoteProps) {
  return (
    <div className="min-h-screen bg-pmu-dark flex flex-col items-center justify-center p-4 text-center">
      {/* Title */}
      <h1 className="font-display text-2xl text-pmu-alert mb-3 uppercase">
        {event.title}
      </h1>

      {/* Description */}
      <p className="text-base text-white/80 font-body mb-4 leading-relaxed max-w-xs">
        {event.description}
      </p>

      {/* Sips info */}
      <div className="text-lg font-bold text-red-400 mb-2">
        {event.sipsAmount} gorgee{event.sipsAmount > 1 ? 's' : ''} a boire !
      </div>

      <p className="text-sm text-white/50 font-body mb-6">
        Est-ce que les parieurs ont bu ?
      </p>

      {/* Vote buttons */}
      <div className="flex gap-3 w-full max-w-xs">
        <button
          onClick={() => onVote(event.id, true)}
          className="flex-1 py-4 bg-green-700 text-white font-display text-xl uppercase border-4 border-green-400 active:bg-green-800 transition-colors"
          style={{ boxShadow: '3px 3px 0px #1a4d1a' }}
        >
          VALIDE
        </button>
        <button
          onClick={() => onVote(event.id, false)}
          className="flex-1 py-4 bg-red-700 text-white font-display text-xl uppercase border-4 border-red-400 active:bg-red-800 transition-colors"
          style={{ boxShadow: '3px 3px 0px #4d1a1a' }}
        >
          PAS VALIDE
        </button>
      </div>

      {/* Vote progress */}
      <div className="mt-4 text-xs text-white/40 font-mono">
        Votes: {Object.keys(event.votes).length} / {event.nonAffectedPlayerIds.length}
      </div>
    </div>
  )
}
