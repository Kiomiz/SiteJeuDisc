'use client'

import { use, useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

const CORRECTION_INTERVAL = 20

// ── Types ───────────────────────────────────────────────────���────

type WeekDoc = NonNullable<ReturnType<typeof useQuery<typeof api.weeks.get>>>
type QuestionDoc = ReturnType<typeof useQuery<typeof api.questions.listByWeek>> extends (infer T)[] | undefined ? T : never
type PlayerDoc = ReturnType<typeof useQuery<typeof api.players.list>> extends (infer T)[] | undefined ? T : never

// ── Main page ────────────────────────────────────────────────────

export default function HostPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = use(params)
  const docId = weekId as Id<'weeks'>

  const [confirmEnd, setConfirmEnd] = useState(false)
  const [busy, setBusy] = useState(false)

  const week = useQuery(api.weeks.get, { weekId: docId })
  const questions = useQuery(api.questions.listByWeek, { weekId: docId })
  const players = useQuery(api.players.list)
  const weekScores = useQuery(api.scores.byWeek, { weekId: docId })

  const currentQuestionNumber = week?.shuffledOrder?.[week.currentQuestionIndex ?? 0]

  const answers = useQuery(
    api.answers.listByQuestion,
    currentQuestionNumber !== undefined
      ? { weekId: docId, questionNumber: currentQuestionNumber }
      : 'skip',
  )

  const doNextQuestion = useMutation(api.weeks.nextQuestion)
  const doStartCorrection = useMutation(api.weeks.startCorrection)
  const doFinishGame = useMutation(api.weeks.finishGame)
  const doStartGame = useMutation(api.weeks.startGame)

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  if (week === undefined || questions === undefined || players === undefined) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </main>
    )
  }

  if (week === null) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center flex-col gap-3">
        <p className="text-gray-400">Semaine introuvable.</p>
        <Link href="/admin" className="text-violet-400 text-sm hover:underline">← Admin</Link>
      </main>
    )
  }

  const totalQuestions = week.shuffledOrder?.length ?? questions.length
  const questionIndex = week.currentQuestionIndex ?? 0
  const currentQuestion = questions.find((q) => q.number === currentQuestionNumber)
  const isLastQuestion = questionIndex + 1 >= totalQuestions
  const isCorrectionDue = (questionIndex + 1) % CORRECTION_INTERVAL === 0

  const answeredIds = new Set(answers?.map((a) => a.playerId) ?? [])
  const notAnswered = players.filter((p) => !answeredIds.has(p._id))

  const scoreMap = Object.fromEntries((weekScores ?? []).map((s) => [s.playerId, s.points]))
  const rankedPlayers = [...players]
    .map((p) => ({ player: p, points: scoreMap[p._id] ?? 0 }))
    .sort((a, b) => b.points - a.points)

  // ── WAITING ──
  if (!week.phase || week.phase === 'waiting') {
    return (
      <HostShell week={week}>
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-xl font-bold text-white">Partie non démarrée</p>
          <Link href={`/admin/week/${week._id}`} className="px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-colors">
            Aller dans l&apos;admin →
          </Link>
        </div>
      </HostShell>
    )
  }

  // ── CORRECTION ──
  if (week.phase === 'correction') {
    return (
      <HostShell week={week}>
        <CorrectionView docId={docId} week={week} questions={questions} />
      </HostShell>
    )
  }

  // ── FINISHED ──
  if (week.phase === 'finished') {
    return (
      <HostShell week={week}>
        <div className="flex flex-col gap-6">
          <div className="text-center pt-4">
            <p className="text-4xl mb-2">🏁</p>
            <p className="text-xl font-bold text-white">Partie terminée !</p>
          </div>
          <ScorePanel rankedPlayers={rankedPlayers} />
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              href="/leaderboard"
              className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-colors"
            >
              🏆 Classement général
            </Link>
            <button
              onClick={() => run(() => doStartGame({ weekId: docId }))}
              disabled={busy}
              className="px-5 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-semibold transition-colors"
            >
              🔄 Relancer la partie
            </button>
          </div>
        </div>
      </HostShell>
    )
  }

  // ── QUESTION ──
  return (
    <HostShell week={week}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: question + answers */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>Question <span className="text-white font-bold">{questionIndex + 1}</span> / {totalQuestions}</span>
            <span className="text-violet-400 font-mono text-xs">#{currentQuestionNumber}</span>
          </div>
          <div className="w-full h-1.5 bg-gray-800 rounded-full">
            <div
              className="h-1.5 bg-violet-500 rounded-full transition-all duration-500"
              style={{ width: `${((questionIndex + 1) / totalQuestions) * 100}%` }}
            />
          </div>

          <div className="p-5 rounded-2xl border border-gray-700 bg-gray-800/60">
            <p className="text-xl font-bold text-white leading-snug">{currentQuestion?.text ?? '…'}</p>
            {currentQuestion?.category && (
              <p className="text-xs text-violet-400 mt-2">{currentQuestion.category}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Réponses</h3>
              <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${
                answers?.length === players.length ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-300'
              }`}>
                {answers?.length ?? 0} / {players.length}
              </span>
            </div>

            {answers === undefined ? (
              <div className="h-10 rounded-lg bg-gray-800 animate-pulse" />
            ) : answers.length === 0 ? (
              <p className="text-gray-600 text-sm italic">Aucune réponse encore…</p>
            ) : (
              <div className="flex flex-col gap-2">
                <AnimatePresence>
                  {answers.map((a) => (
                    <motion.div
                      key={a._id}
                      initial={{ opacity: 0, x: -20, scale: 0.96 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-700 bg-gray-800/40"
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0" style={{ backgroundColor: a.player?.color ?? '#6b7280' }}>
                        {a.player?.avatar ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500">{a.player?.pseudo ?? '…'}</p>
                        <p className="text-sm font-semibold text-white truncate">{a.text}</p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {notAnswered.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {notAnswered.map((p) => (
                  <div key={p._id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-800/60 border border-gray-700 opacity-50">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0" style={{ backgroundColor: p.color }}>
                      {p.avatar}
                    </div>
                    <span className="text-xs text-gray-400">{p.pseudo}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 pt-2">
            {isCorrectionDue && (
              <p className="text-xs text-yellow-400 text-center">
                💡 {CORRECTION_INTERVAL} questions écoulées — pensez à faire une correction
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => run(() => doStartCorrection({ weekId: docId }))}
                disabled={busy}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 ${
                  isCorrectionDue
                    ? 'bg-yellow-600 hover:bg-yellow-500 text-white shadow-lg shadow-yellow-900/30'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                }`}
              >
                📝 Passer en correction
              </button>

              {confirmEnd ? (
                <div className="flex-1 flex gap-2">
                  <button onClick={() => setConfirmEnd(false)} className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold">
                    Annuler
                  </button>
                  <button onClick={() => run(() => doFinishGame({ weekId: docId }))} disabled={busy} className="flex-1 py-3 rounded-xl bg-red-700 hover:bg-red-600 text-white text-sm font-semibold disabled:opacity-50">
                    Confirmer 🏁
                  </button>
                </div>
              ) : isLastQuestion ? (
                <button onClick={() => setConfirmEnd(true)} disabled={busy} className="flex-1 py-3 rounded-xl bg-red-800 hover:bg-red-700 text-white font-bold text-sm transition-colors disabled:opacity-50">
                  🏁 Terminer la partie
                </button>
              ) : (
                <button onClick={() => run(() => doNextQuestion({ weekId: docId }))} disabled={busy} className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm transition-colors disabled:opacity-50">
                  Question suivante →
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: live scores */}
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Scores en direct</h3>
          <ScorePanel rankedPlayers={rankedPlayers} />
        </div>
      </div>
    </HostShell>
  )
}

// ── CorrectionView ───────────────────────────────────────────────

function CorrectionView({
  docId,
  week,
  questions,
}: {
  docId: Id<'weeks'>
  week: WeekDoc
  questions: QuestionDoc[]
}) {
  const correctionFrom = week.correctionFromIndex ?? 0
  const correctionTo = week.currentQuestionIndex ?? 0

  const blockNumbers = (week.shuffledOrder ?? []).slice(correctionFrom, correctionTo + 1)
  const blockQuestions = blockNumbers
    .map((num) => questions.find((q) => q.number === num))
    .filter((q): q is QuestionDoc => q !== undefined)

  const [qIdx, setQIdx] = useState(0)
  const [pIdx, setPIdx] = useState(0)
  const [pts, setPts] = useState('1')
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const currentQ = blockQuestions[qIdx]

  const answers = useQuery(
    api.answers.listByQuestion,
    currentQ ? { weekId: docId, questionNumber: currentQ.number } : 'skip',
  )

  const doAttributePoints = useMutation(api.answers.attributePoints)
  const doFinishCorrection = useMutation(api.weeks.finishCorrection)

  useEffect(() => {
    setPIdx(0)
    setError('')
  }, [qIdx])

  const currentAnswer = answers?.[pIdx]

  useEffect(() => {
    setPts(currentAnswer?.points !== undefined ? String(currentAnswer.points) : '1')
  }, [currentAnswer?._id, currentAnswer?.points])

  function advance() {
    const nextP = pIdx + 1
    if (answers && nextP < answers.length) {
      setPIdx(nextP)
    } else {
      const nextQ = qIdx + 1
      if (nextQ < blockQuestions.length) {
        setQIdx(nextQ)
      } else {
        setDone(true)
      }
    }
  }

  async function handleValidate() {
    if (!currentAnswer || saving) return
    setSaving(true)
    setError('')
    try {
      await doAttributePoints({ answerId: currentAnswer._id, points: parseInt(pts) || 0 })
      advance()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  async function handleFinish() {
    setSaving(true)
    try { await doFinishCorrection({ weekId: docId }) }
    finally { setSaving(false) }
  }

  // ── Empty block ──
  if (blockQuestions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-gray-400">Aucune question dans ce bloc.</p>
        <button onClick={handleFinish} disabled={saving} className="px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold transition-colors">
          Reprendre le jeu →
        </button>
      </div>
    )
  }

  // ── All done ──
  if (done) {
    return (
      <div className="flex flex-col items-center gap-6 py-12">
        <p className="text-4xl">✅</p>
        <p className="text-xl font-bold text-white">Correction terminée !</p>
        <p className="text-gray-500 text-sm">{blockQuestions.length} questions corrigées</p>
        <button
          onClick={handleFinish}
          disabled={saving}
          className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold text-base transition-colors"
        >
          {saving ? '…' : '▶ Reprendre le jeu'}
        </button>
      </div>
    )
  }

  // ── Main correction UI ──
  const totalAnswers = answers?.length ?? 0

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">📝 Correction</h2>
        <div className="text-right">
          <p className="text-xs text-gray-400">Question {qIdx + 1} / {blockQuestions.length}</p>
          {totalAnswers > 0 && (
            <p className="text-xs text-gray-600">Joueur {pIdx + 1} / {totalAnswers}</p>
          )}
        </div>
      </div>

      {/* Question progress */}
      <div className="w-full h-1 bg-gray-800 rounded-full">
        <div
          className="h-1 bg-yellow-500 rounded-full transition-all"
          style={{ width: `${((qIdx + 1) / blockQuestions.length) * 100}%` }}
        />
      </div>

      {/* Question card */}
      <div className="p-4 rounded-2xl border border-gray-700 bg-gray-800/60">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-mono text-violet-400">#{currentQ?.number}</span>
          {currentQ?.category && <span className="text-xs text-gray-500">{currentQ.category}</span>}
        </div>
        <p className="text-base font-semibold text-white leading-snug">{currentQ?.text}</p>
      </div>

      {/* Answer area */}
      {answers === undefined ? (
        <div className="h-40 rounded-xl bg-gray-800 animate-pulse" />
      ) : answers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 rounded-xl border border-gray-700 bg-gray-800/40">
          <p className="text-gray-500 text-sm">Personne n&apos;a répondu à cette question.</p>
          <button
            onClick={() => {
              const nextQ = qIdx + 1
              if (nextQ < blockQuestions.length) setQIdx(nextQ)
              else setDone(true)
            }}
            className="px-4 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors"
          >
            Passer →
          </button>
        </div>
      ) : currentAnswer ? (
        <AnimatePresence mode="wait">
        <motion.div
          key={currentAnswer._id}
          initial={{ opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -14, scale: 0.96 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="flex flex-col gap-4"
        >
          {/* Player + answer */}
          <div className="p-5 rounded-2xl border border-yellow-700/60 bg-yellow-900/10">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0"
                style={{ backgroundColor: currentAnswer.player?.color ?? '#6b7280' }}
              >
                {currentAnswer.player?.avatar ?? '?'}
              </div>
              <p className="font-bold text-white text-lg">{currentAnswer.player?.pseudo ?? '?'}</p>
              {currentAnswer.points !== undefined && (
                <span className="ml-auto text-xs text-gray-500">{currentAnswer.points} pts déjà attribués</span>
              )}
            </div>
            <div className="px-4 py-3 rounded-xl bg-gray-950/50 text-center">
              <p className="text-2xl font-black text-white">{currentAnswer.text}</p>
            </div>
          </div>

          {/* Points buttons + input */}
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              {[0, 1, 2, 3].map((p) => (
                <button
                  key={p}
                  onClick={() => setPts(String(p))}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                    pts === String(p)
                      ? 'bg-violet-600 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  }`}
                >
                  {p} pt{p !== 1 ? 's' : ''}
                </button>
              ))}
              <input
                type="number"
                value={pts}
                onChange={(e) => setPts(e.target.value)}
                min={0}
                className="w-16 px-2 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm text-center focus:outline-none focus:border-violet-500"
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <motion.button
              onClick={handleValidate}
              disabled={saving}
              whileTap={{ scale: 0.97 }}
              className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold text-base transition-colors"
            >
              {saving ? '…' : (
                pIdx + 1 < totalAnswers
                  ? '✓ Valider · Joueur suivant →'
                  : qIdx + 1 < blockQuestions.length
                    ? '✓ Valider · Question suivante →'
                    : '✓ Valider'
              )}
            </motion.button>
          </div>
        </motion.div>
        </AnimatePresence>
      ) : null}
    </div>
  )
}

// ── Shared components ────────────────────────────────────────────

type RankedPlayer = { player: PlayerDoc; points: number }

function ScorePanel({ rankedPlayers }: { rankedPlayers: RankedPlayer[] }) {
  if (rankedPlayers.length === 0) return <p className="text-gray-600 text-sm italic">Aucun score.</p>
  return (
    <div className="flex flex-col gap-2">
      {rankedPlayers.map(({ player, points }, i) => (
        <motion.div
          key={player._id}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05, duration: 0.22 }}
          className="flex items-center gap-3 px-3 py-2 rounded-xl border border-gray-700 bg-gray-800/40"
        >
          <span className="text-xs text-gray-500 w-5 text-center shrink-0">#{i + 1}</span>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0" style={{ backgroundColor: player.color }}>
            {player.avatar}
          </div>
          <span className="flex-1 text-sm text-white font-medium truncate">{player.pseudo}</span>
          <span className="text-sm font-black text-violet-300 shrink-0">{points} pts</span>
        </motion.div>
      ))}
    </div>
  )
}

function HostShell({ week, children }: { week: { weekNumber: number; title: string; phase?: string | null }; children: React.ReactNode }) {
  const phaseColors: Record<string, string> = {
    waiting: 'bg-gray-700 text-gray-300',
    question: 'bg-green-900/50 text-green-400',
    correction: 'bg-yellow-900/50 text-yellow-400',
    finished: 'bg-gray-700 text-gray-400',
  }
  const phaseLabel: Record<string, string> = {
    waiting: 'En attente',
    question: '● En cours',
    correction: '● Correction',
    finished: 'Terminée',
  }
  const phase = week.phase ?? 'waiting'
  return (
    <main className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <Link href="/admin" className="text-gray-500 hover:text-white transition-colors text-sm shrink-0">⚙️ Admin</Link>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">Semaine {week.weekNumber} — {week.title}</p>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${phaseColors[phase]}`}>
          {phaseLabel[phase]}
        </span>
      </header>
      <div className="max-w-4xl mx-auto px-4 py-6">{children}</div>
    </main>
  )
}
