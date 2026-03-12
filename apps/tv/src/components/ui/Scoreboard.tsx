'use client'

import type { Player } from '@last-sip-derby/shared'

interface ScoreboardProps {
  players: Player[]
  layout?: 'horizontal' | 'vertical'
}

export function Scoreboard({ players, layout = 'vertical' }: ScoreboardProps) {
  const topGivers = [...players]
    .filter((p) => p.totalSipsGiven > 0)
    .sort((a, b) => b.totalSipsGiven - a.totalSipsGiven)
    .slice(0, 3)

  const topDrinkers = [...players]
    .filter((p) => p.totalSipsDrunk > 0)
    .sort((a, b) => b.totalSipsDrunk - a.totalSipsDrunk)
    .slice(0, 3)

  if (layout === 'horizontal') {
    return (
      <div className="flex items-center gap-8 font-body text-[24px]">
        {topGivers.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="font-display text-[26px] text-derby-gold">TOP DONNEURS</span>
            {topGivers.map((p, i) => (
              <span key={p.pseudo} className="text-derby-text">
                <span className="text-derby-muted">{i + 1}.</span>{' '}
                {p.pseudo}{' '}
                <span className="font-mono text-derby-gold">{p.totalSipsGiven}G</span>
              </span>
            ))}
          </div>
        )}
        <div className="w-px h-6 bg-derby-muted/30" />
        {topDrinkers.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="font-display text-[26px] text-derby-red">TOP BUVEURS</span>
            {topDrinkers.map((p, i) => (
              <span key={p.pseudo} className="text-derby-text">
                <span className="text-derby-muted">{i + 1}.</span>{' '}
                {p.pseudo}{' '}
                <span className="font-mono text-derby-red">{p.totalSipsDrunk}G</span>
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  const debtors = [...players]
    .filter((p) => p.debt > 0)
    .sort((a, b) => b.debt - a.debt)

  return (
    <div className="space-y-5">
      {topGivers.length > 0 && (
        <ScoreSection
          title="TOP DONNEURS"
          color="text-derby-gold"
          entries={topGivers.map((p) => ({ name: p.pseudo, value: `${p.totalSipsGiven}G` }))}
        />
      )}
      {topDrinkers.length > 0 && (
        <ScoreSection
          title="TOP BUVEURS"
          color="text-derby-red"
          entries={topDrinkers.map((p) => ({ name: p.pseudo, value: `${p.totalSipsDrunk}G` }))}
        />
      )}
      {debtors.length > 0 && (
        <ScoreSection
          title="MAUVAIS PAYEURS"
          color="text-derby-red"
          entries={debtors.map((p) => ({ name: p.pseudo, value: `${p.debt}G` }))}
        />
      )}
    </div>
  )
}

function ScoreSection({
  title,
  color,
  entries,
}: {
  title: string
  color: string
  entries: Array<{ name: string; value: string }>
}) {
  return (
    <div>
      <h3 className={`font-display text-[26px] mb-1 ${color}`}>
        {title}
      </h3>
      <div className="space-y-1">
        {entries.map((entry, i) => (
          <div key={entry.name} className="flex justify-between text-derby-text text-[24px] font-body">
            <span className="truncate">
              <span className="text-derby-muted">{i + 1}.</span> {entry.name}
            </span>
            <span className="font-mono ml-3">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
