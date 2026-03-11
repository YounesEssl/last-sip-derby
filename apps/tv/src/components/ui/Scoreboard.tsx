'use client'

import type { Player } from '@last-sip-derby/shared'

interface ScoreboardProps {
  players: Player[]
}

export function Scoreboard({ players }: ScoreboardProps) {
  const topGivers = [...players]
    .sort((a, b) => b.totalSipsGiven - a.totalSipsGiven)
    .slice(0, 5)

  const topDrinkers = [...players]
    .sort((a, b) => b.totalSipsDrunk - a.totalSipsDrunk)
    .slice(0, 5)

  const debtors = [...players]
    .filter((p) => p.debt > 0)
    .sort((a, b) => b.debt - a.debt)

  return (
    <div className="space-y-4 text-sm">
      <ScoreSection
        title="Plus Gros Donneurs"
        icon="🏆"
        entries={topGivers.map((p) => ({ name: p.pseudo, value: `${p.totalSipsGiven}G` }))}
      />
      <ScoreSection
        title="Plus Gros Buveurs"
        icon="🍺"
        entries={topDrinkers.map((p) => ({ name: p.pseudo, value: `${p.totalSipsDrunk}G` }))}
      />
      {debtors.length > 0 && (
        <ScoreSection
          title="Mauvais Payeurs"
          icon="😤"
          entries={debtors.map((p) => ({ name: p.pseudo, value: `${p.debt}G` }))}
          highlight
        />
      )}
    </div>
  )
}

function ScoreSection({
  title,
  icon,
  entries,
  highlight,
}: {
  title: string
  icon: string
  entries: Array<{ name: string; value: string }>
  highlight?: boolean
}) {
  if (entries.length === 0) return null

  return (
    <div>
      <h3 className={`font-display text-lg mb-1 ${highlight ? 'text-derby-red' : 'text-derby-gold'}`}>
        {icon} {title}
      </h3>
      <div className="space-y-0.5">
        {entries.map((entry, i) => (
          <div key={entry.name} className="flex justify-between text-gray-300">
            <span className="truncate">
              {i + 1}. {entry.name}
            </span>
            <span className="font-mono text-white ml-2">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
