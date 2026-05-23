'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'

interface Props {
  selectedWeekId: Id<'weeks'> | null
  onSelect: (id: Id<'weeks'>) => void
}

export function WeekNav({ selectedWeekId, onSelect }: Props) {
  const weeks = useQuery(api.weeks.list)

  if (weeks === undefined) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2 px-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="shrink-0 w-28 h-20 rounded-xl bg-gray-800 animate-pulse" />
        ))}
      </div>
    )
  }

  if (weeks.length === 0) {
    return (
      <p className="text-gray-500 text-sm text-center py-4">
        Aucune semaine encore — l&apos;hôte en créera une bientôt.
      </p>
    )
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 px-1 snap-x snap-mandatory">
      {weeks.map((week) => {
        const isSelected = selectedWeekId === week._id
        const isPlayed = week.playedAt !== undefined

        let cardClass = 'shrink-0 w-28 snap-start rounded-xl border p-3 cursor-pointer transition-all select-none '
        if (isSelected) {
          cardClass += 'border-violet-500 bg-violet-900/40 shadow-lg shadow-violet-900/30'
        } else if (isPlayed) {
          cardClass += 'border-gray-700 bg-gray-800/60 opacity-70 hover:opacity-100'
        } else {
          cardClass += 'border-gray-700 bg-gray-800/60 hover:border-gray-500'
        }

        return (
          <button key={week._id} className={cardClass} onClick={() => onSelect(week._id)}>
            <div className="text-xs text-gray-400 mb-1">Semaine {week.weekNumber}</div>
            <div className="text-sm font-semibold text-white leading-tight line-clamp-2">
              {week.title}
            </div>
            {isPlayed && (
              <div className="mt-2 text-xs text-green-400">✓ Jouée</div>
            )}
            {week.isActive && !isPlayed && (
              <div className="mt-2 text-xs text-yellow-400 animate-pulse">● En cours</div>
            )}
          </button>
        )
      })}
    </div>
  )
}
