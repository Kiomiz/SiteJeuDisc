'use client'

import { use, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import Link from 'next/link'

function parseTxt(raw: string): { number: number; text: string }[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes('-->'))
    .map((line) => {
      const idx = line.indexOf('-->')
      const num = parseInt(line.slice(0, idx).trim())
      const text = line.slice(idx + 3).trim()
      return { number: num, text }
    })
    .filter((q) => !isNaN(q.number) && q.text.length > 0)
}

export default function AdminWeekPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = use(params)
  const docId = weekId as Id<'weeks'>

  const week = useQuery(api.weeks.get, { weekId: docId })
  const questions = useQuery(api.questions.listByWeek, { weekId: docId })
  const clearAndSeed = useMutation(api.questions.clearAndSeed)
  const startGame = useMutation(api.weeks.startGame)

  const [rawText, setRawText] = useState('')
  const [preview, setPreview] = useState<{ number: number; text: string }[]>([])
  const [importing, setImporting] = useState(false)
  const [starting, setStarting] = useState(false)
  const [importError, setImportError] = useState('')
  const [startError, setStartError] = useState('')

  function handleParse() {
    setPreview(parseTxt(rawText))
  }

  async function handleImport() {
    if (preview.length === 0) return
    setImporting(true)
    setImportError('')
    try {
      await clearAndSeed({ weekId: docId, questions: preview })
      setRawText('')
      setPreview([])
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setImporting(false)
    }
  }

  async function handleStartGame() {
    setStarting(true)
    setStartError('')
    try {
      await startGame({ weekId: docId })
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setStarting(false)
    }
  }

  if (week === undefined || questions === undefined) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </main>
    )
  }

  if (week === null) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Semaine introuvable.</p>
      </main>
    )
  }

  const gameStarted = week.phase && week.phase !== 'waiting'
  const sortedQuestions = [...questions].sort((a, b) => a.number - b.number)

  return (
    <main className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 px-4 py-4 flex items-center gap-3">
        <Link href="/admin" className="text-gray-400 hover:text-white transition-colors text-sm">
          ← Admin
        </Link>
        <div>
          <h1 className="text-xl font-black text-white">
            Semaine {week.weekNumber} — {week.title}
          </h1>
          <p className="text-xs text-gray-500">{week.gameType} · {questions.length} question{questions.length !== 1 ? 's' : ''}</p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-8">
        {/* Launch game */}
        <section className="p-4 rounded-xl border border-gray-700 bg-gray-800/40">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Contrôle de partie
          </h2>
          {gameStarted ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`font-semibold ${week.phase === 'finished' ? 'text-gray-400' : 'text-green-400'}`}>
                  Phase : {week.phase}
                </span>
                <Link
                  href={`/week/${week._id}/host`}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors"
                >
                  Vue host →
                </Link>
              </div>
              {week.phase === 'finished' && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-gray-500">La partie est terminée. Tu peux la relancer avec un nouvel ordre aléatoire.</p>
                  {startError && <p className="text-red-400 text-sm">{startError}</p>}
                  <button
                    onClick={handleStartGame}
                    disabled={starting}
                    className="self-start px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                  >
                    {starting ? 'Lancement...' : '🔄 Relancer la partie'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-gray-400">
                {questions.length === 0
                  ? 'Importe des questions avant de lancer.'
                  : `${questions.length} question${questions.length !== 1 ? 's' : ''} prêtes.`}
              </p>
              {startError && <p className="text-red-400 text-sm">{startError}</p>}
              <button
                onClick={handleStartGame}
                disabled={starting || questions.length === 0}
                className="self-start px-5 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-semibold transition-colors"
              >
                {starting ? 'Lancement...' : '🚀 Lancer la partie'}
              </button>
            </div>
          )}
        </section>

        {/* Import questions */}
        {!gameStarted && (
          <section>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Importer les questions
            </h2>
            <div className="flex flex-col gap-3 p-4 rounded-xl border border-gray-700 bg-gray-800/40">
              <p className="text-xs text-gray-500">
                Format attendu par ligne : <code className="text-violet-400">1--&gt;Texte de la question</code>
              </p>
              <textarea
                value={rawText}
                onChange={(e) => { setRawText(e.target.value); setPreview([]) }}
                placeholder={"1-->Quelle est la capitale du Canada ?\n2-->Qui a peint La Joconde ?"}
                rows={8}
                className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm font-mono focus:outline-none focus:border-violet-500 resize-y"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleParse}
                  disabled={!rawText.trim()}
                  className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white text-sm font-medium transition-colors"
                >
                  Analyser ({parseTxt(rawText).length} détectées)
                </button>
                {preview.length > 0 && (
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                  >
                    {importing ? 'Import...' : `✓ Importer ${preview.length} questions`}
                  </button>
                )}
              </div>
              {importError && <p className="text-red-400 text-sm">{importError}</p>}
              {preview.length > 0 && (
                <div className="mt-2 flex flex-col gap-1 max-h-48 overflow-y-auto">
                  {preview.map((q) => (
                    <div key={q.number} className="text-xs text-gray-300 flex gap-2">
                      <span className="text-violet-400 font-mono w-6 shrink-0">#{q.number}</span>
                      <span className="truncate">{q.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Questions list */}
        {sortedQuestions.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Questions importées ({sortedQuestions.length})
            </h2>
            <div className="flex flex-col gap-2">
              {sortedQuestions.map((q) => (
                <div
                  key={q._id}
                  className="flex gap-3 px-3 py-2 rounded-lg border border-gray-700 bg-gray-800/40"
                >
                  <span className="text-violet-400 font-mono text-sm w-8 shrink-0">#{q.number}</span>
                  <span className="text-sm text-gray-200 flex-1">{q.text}</span>
                  {q.category && (
                    <span className="text-xs text-gray-500 shrink-0">{q.category}</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
