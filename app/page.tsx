'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { WeekNav } from './components/WeekNav'
import { PlayerGrid } from './components/PlayerGrid'
import { CreatePlayerModal } from './components/CreatePlayerModal'
import { Id } from '@/convex/_generated/dataModel'

const STORAGE_KEY = 'quiznight_player_id'

export default function Home() {
  const [selectedWeekId, setSelectedWeekId] = useState<Id<'weeks'> | null>(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState<Id<'players'> | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) setSelectedPlayerId(saved as Id<'players'>)
  }, [])

  function handleSelectPlayer(id: Id<'players'>) {
    setSelectedPlayerId(id)
    localStorage.setItem(STORAGE_KEY, id)
  }

  return (
    <main className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            QUIZ <span className="text-violet-400">NIGHT</span>
          </h1>
          <p className="text-xs text-gray-500">Le jeu du vendredi soir</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/leaderboard"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm font-medium text-white transition-colors"
          >
            🏆 Classement
          </Link>
          <Link
            href="/admin"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            ⚙️
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-8">
        {/* Who are you? */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            C&apos;est qui ?
          </h2>
          <PlayerGrid
            selectedPlayerId={selectedPlayerId}
            onSelect={handleSelectPlayer}
            onCreateNew={() => setShowCreateModal(true)}
          />
        </section>

        {/* Week navigation */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Les semaines
          </h2>
          <WeekNav selectedWeekId={selectedWeekId} onSelect={setSelectedWeekId} />
        </section>

        {/* Play button */}
        {selectedWeekId && selectedPlayerId && (
          <section className="flex justify-center">
            <Link
              href={`/week/${selectedWeekId}`}
              className="px-8 py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white text-lg font-bold shadow-lg shadow-violet-900/40 transition-all hover:scale-105 active:scale-95"
            >
              Jouer →
            </Link>
          </section>
        )}

        {selectedWeekId && !selectedPlayerId && (
          <p className="text-center text-gray-500 text-sm">
            Sélectionne ton profil pour jouer
          </p>
        )}
      </div>

      {showCreateModal && (
        <CreatePlayerModal onClose={() => setShowCreateModal(false)} />
      )}
    </main>
  )
}
