'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import Link from 'next/link'

const PHASE_LABEL: Record<string, string> = {
  waiting: 'En attente',
  question: '🟢 En cours',
  correction: '🟡 Correction',
  finished: '✅ Terminée',
}

export default function AdminPage() {
  const weeks = useQuery(api.weeks.list)
  const createWeek = useMutation(api.weeks.create)
  const deleteWeek = useMutation(api.weeks.deleteWeek)

  const [weekNumber, setWeekNumber] = useState('')
  const [title, setTitle] = useState('')
  const [gameType, setGameType] = useState('Quiz')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(weekId: string) {
    setDeleting(true)
    try {
      await deleteWeek({ weekId: weekId as Id<'weeks'> })
      setConfirmDeleteId(null)
    } finally {
      setDeleting(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!weekNumber || !title) return
    setLoading(true)
    setError('')
    try {
      await createWeek({ weekNumber: parseInt(weekNumber), title, gameType })
      setWeekNumber('')
      setTitle('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 px-4 py-4 flex items-center gap-3">
        <Link href="/" className="text-gray-400 hover:text-white transition-colors text-sm">
          ← Accueil
        </Link>
        <h1 className="text-xl font-black text-white">⚙️ Admin</h1>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-8">
        {/* Create week */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Nouvelle semaine
          </h2>
          <form onSubmit={handleCreate} className="flex flex-col gap-3 p-4 rounded-xl border border-gray-700 bg-gray-800/40">
            <div className="flex gap-3">
              <input
                type="number"
                placeholder="N°"
                value={weekNumber}
                onChange={(e) => setWeekNumber(e.target.value)}
                className="w-20 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm focus:outline-none focus:border-violet-500"
                required
              />
              <input
                type="text"
                placeholder="Titre (ex: Culture G)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm focus:outline-none focus:border-violet-500"
                required
              />
              <input
                type="text"
                placeholder="Type"
                value={gameType}
                onChange={(e) => setGameType(e.target.value)}
                className="w-24 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="self-start px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >
              {loading ? 'Création...' : 'Créer'}
            </button>
          </form>
        </section>

        {/* Weeks list */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Semaines existantes
          </h2>
          {weeks === undefined ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-gray-800 animate-pulse" />)}
            </div>
          ) : weeks.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">Aucune semaine encore.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {weeks.map((week) => {
                const phase = week.phase ?? 'waiting'
                return (
                  <div
                    key={week._id}
                    className="flex items-center gap-4 px-4 py-3 rounded-xl border border-gray-700 bg-gray-800/40"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white">
                        Semaine {week.weekNumber} — {week.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {PHASE_LABEL[phase] ?? phase} · {week.gameType}
                      </p>
                    </div>
                    {confirmDeleteId === week._id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={() => handleDelete(week._id)}
                          disabled={deleting}
                          className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                        >
                          {deleting ? '…' : 'Confirmer'}
                        </button>
                      </div>
                    ) : (
                      <>
                        <Link
                          href={`/admin/week/${week._id}`}
                          className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors"
                        >
                          Gérer →
                        </Link>
                        <button
                          onClick={() => setConfirmDeleteId(week._id)}
                          className="px-2 py-1.5 rounded-lg bg-gray-800 hover:bg-red-900/40 text-gray-400 hover:text-red-400 text-sm transition-colors"
                          title="Supprimer"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
