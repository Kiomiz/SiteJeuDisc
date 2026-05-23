'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { motion } from 'framer-motion'

interface Props {
  selectedPlayerId: Id<'players'> | null
  onSelect: (id: Id<'players'>) => void
  onCreateNew: () => void
}

export function PlayerGrid({ selectedPlayerId, onSelect, onCreateNew }: Props) {
  const players = useQuery(api.players.list)

  if (players === undefined) {
    return (
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="aspect-square rounded-xl bg-gray-800 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {players.map((player, i) => {
        const isSelected = selectedPlayerId === player._id
        return (
          <motion.button
            key={player._id}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04, duration: 0.2, ease: 'backOut' }}
            whileTap={{ scale: 0.93 }}
            onClick={() => onSelect(player._id)}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-colors ${
              isSelected
                ? 'border-violet-500 bg-violet-900/30 shadow-lg shadow-violet-900/20'
                : 'border-gray-700 bg-gray-800/60 hover:border-gray-500'
            }`}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
              style={{ backgroundColor: player.color }}
            >
              {player.avatar}
            </div>
            <span className="text-xs font-medium text-white truncate w-full text-center">
              {player.pseudo}
            </span>
            {isSelected && (
              <span className="text-xs text-violet-400">Sélectionné</span>
            )}
          </motion.button>
        )
      })}

      <motion.button
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: players.length * 0.04, duration: 0.2 }}
        whileTap={{ scale: 0.93 }}
        onClick={onCreateNew}
        className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-gray-600 hover:border-violet-500 hover:bg-violet-900/10 transition-colors text-gray-400 hover:text-violet-400"
      >
        <span className="text-3xl">+</span>
        <span className="text-xs font-medium">Nouveau</span>
      </motion.button>
    </div>
  )
}
