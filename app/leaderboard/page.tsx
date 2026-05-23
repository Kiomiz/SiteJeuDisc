'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import Link from 'next/link'

const MEDALS = ['🥇', '🥈', '🥉']

export default function Leaderboard() {
  const ranking = useQuery(api.scores.allTime)

  return (
    <main className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 px-4 py-4 flex items-center gap-3">
        <Link
          href="/"
          className="text-gray-400 hover:text-white transition-colors text-sm"
        >
          ← Retour
        </Link>
        <h1 className="text-xl font-black text-white">
          🏆 Classement général
        </h1>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        {ranking === undefined ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-gray-800 animate-pulse" />
            ))}
          </div>
        ) : ranking.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🎮</p>
            <p className="text-gray-400">Aucun score encore — jouez une semaine !</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {ranking.map(({ player, total }, index) => {
              const isTop3 = index < 3
              return (
                <div
                  key={player._id}
                  className={`flex items-center gap-4 px-4 py-3 rounded-xl border ${
                    isTop3
                      ? 'border-violet-700 bg-violet-900/20'
                      : 'border-gray-700 bg-gray-800/40'
                  }`}
                >
                  <span className="text-2xl w-8 text-center shrink-0">
                    {MEDALS[index] ?? <span className="text-gray-400 text-base font-bold">#{index + 1}</span>}
                  </span>
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0"
                    style={{ backgroundColor: player.color }}
                  >
                    {player.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate">{player.pseudo}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-black text-white">{total}</p>
                    <p className="text-xs text-gray-500">pts</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
