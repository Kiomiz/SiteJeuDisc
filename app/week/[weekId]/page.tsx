'use client'

import { use, useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

const STORAGE_KEY = 'quiznight_player_id'

export default function WeekPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = use(params)
  const docId = weekId as Id<'weeks'>

  const [playerId, setPlayerId] = useState<Id<'players'> | null>(null)
  const [answerText, setAnswerText] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) setPlayerId(saved as Id<'players'>)
  }, [])

  const week = useQuery(api.weeks.get, { weekId: docId })
  const questions = useQuery(api.questions.listByWeek, { weekId: docId })
  const player = useQuery(api.players.get, playerId ? { playerId } : 'skip')
  const allPlayers = useQuery(api.players.list)
  const weekScores = useQuery(api.scores.byWeek, { weekId: docId })
  const saveDraftMutation = useMutation(api.answers.saveDraft)

  const currentQuestionNumber =
    week?.shuffledOrder?.[week.currentQuestionIndex ?? 0]

  const correctionBlockNumbers =
    week?.phase === 'correction' && week.shuffledOrder
      ? week.shuffledOrder.slice(
          week.correctionFromIndex ?? 0,
          (week.currentQuestionIndex ?? 0) + 1,
        )
      : []

  const blockAnswers = useQuery(
    api.answers.listByCorrectionBlock,
    week?.phase === 'correction' && correctionBlockNumbers.length > 0
      ? { weekId: docId, questionNumbers: correctionBlockNumbers }
      : 'skip',
  )

  const myAnswer = useQuery(
    api.answers.myAnswer,
    playerId && currentQuestionNumber !== undefined
      ? { playerId, weekId: docId, questionNumber: currentQuestionNumber }
      : 'skip',
  )

  // Reset input when question changes
  useEffect(() => {
    setAnswerText('')
  }, [currentQuestionNumber])

  // Pre-fill if player already answered
  useEffect(() => {
    if (myAnswer?.text) setAnswerText(myAnswer.text)
  }, [myAnswer?.text])

  // Save draft in real-time as player types
  useEffect(() => {
    if (!playerId || currentQuestionNumber === undefined || !answerText.trim()) return
    const id = setTimeout(() => {
      saveDraftMutation({
        playerId,
        weekId: docId,
        questionNumber: currentQuestionNumber,
        text: answerText,
      }).catch(() => {})
    }, 150)
    return () => clearTimeout(id)
  }, [answerText, playerId, currentQuestionNumber, docId, saveDraftMutation])

  // Loading
  if (week === undefined || questions === undefined) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </main>
    )
  }

  if (week === null) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center flex-col gap-4">
        <p className="text-gray-400">Semaine introuvable.</p>
        <Link href="/" className="text-violet-400 hover:underline text-sm">← Retour</Link>
      </main>
    )
  }

  if (!playerId) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center flex-col gap-4">
        <p className="text-xl text-white font-bold">Qui es-tu ?</p>
        <p className="text-gray-400 text-sm">Sélectionne ton profil depuis l&apos;accueil pour jouer.</p>
        <Link href="/" className="px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-colors">
          ← Choisir mon profil
        </Link>
      </main>
    )
  }

  const myScore = weekScores?.find((s) => s.playerId === playerId)?.points ?? 0
  const totalQuestions = week.shuffledOrder?.length ?? questions.length
  const questionIndex = week.currentQuestionIndex ?? 0
  const currentQuestion = questions.find((q) => q.number === currentQuestionNumber)

  // WAITING
  if (!week.phase || week.phase === 'waiting') {
    return (
      <PageShell week={week} player={player} score={myScore}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
          className="flex flex-col items-center gap-4 py-12">
          <div className="w-12 h-12 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          <p className="text-xl font-bold text-white">En attente du host…</p>
          <p className="text-gray-500 text-sm">La partie va bientôt commencer.</p>
        </motion.div>
      </PageShell>
    )
  }

  // CORRECTION
  if (week.phase === 'correction') {
    const blockQuestions = correctionBlockNumbers
      .map((num) => questions.find((q) => q.number === num))
      .filter((q): q is NonNullable<typeof q> => q !== undefined)

    return (
      <PageShell week={week} player={player} score={myScore}>
        <CorrectionWatcher
          blockQuestions={blockQuestions}
          blockAnswers={blockAnswers}
          myPlayerId={playerId}
          myScore={myScore}
        />
      </PageShell>
    )
  }

  // FINISHED
  if (week.phase === 'finished') {
    return (
      <PageShell week={week} player={player} score={myScore}>
        <div className="flex flex-col gap-6">
          <div className="text-center pt-4">
            <p className="text-4xl mb-2">🎉</p>
            <p className="text-xl font-black text-white">Partie terminée !</p>
            <p className="text-sm text-gray-500 mt-1">Semaine {week.weekNumber} — résultats finaux</p>
          </div>
          <Podium
            weekScores={weekScores}
            allPlayers={allPlayers?.filter((p) => p._id !== week.hostPlayerId)}
            myPlayerId={playerId}
          />
          <Link
            href="/leaderboard"
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-colors"
          >
            🏆 Classement général
          </Link>
        </div>
      </PageShell>
    )
  }

  // QUESTION
  return (
    <PageShell week={week} player={player} score={myScore}>
      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
        <span>Question {questionIndex + 1} / {totalQuestions}</span>
        <span className="text-violet-400 font-mono">#{currentQuestionNumber}</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-gray-800 rounded-full mb-6">
        <div
          className="h-1.5 bg-violet-500 rounded-full transition-all duration-500"
          style={{ width: `${((questionIndex + 1) / totalQuestions) * 100}%` }}
        />
      </div>

      <AnimatePresence mode="wait">
        {currentQuestion ? (
          <motion.div
            key={currentQuestionNumber}
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="flex flex-col gap-6"
          >
            <p className="text-lg font-semibold text-white leading-snug">
              {currentQuestion.text}
            </p>

            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="Ta réponse…"
                autoComplete="off"
                className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white text-base focus:outline-none focus:border-violet-500 transition-colors"
              />
              <p className="text-xs text-gray-600 text-right">
                {answerText.trim() ? '✓ sauvegardé automatiquement' : 'tape ta réponse ci-dessus'}
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.p key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-gray-500 text-sm text-center py-8">
            Chargement de la question…
          </motion.p>
        )}
      </AnimatePresence>
    </PageShell>
  )
}

// ── Podium ────────────────────────────────────────────────────

type ScoreRow = { playerId: string; points: number }
type PlayerRow = { _id: string; pseudo: string; avatar: string; color: string; photoUrl?: string | null }

function Podium({
  weekScores,
  allPlayers,
  myPlayerId,
}: {
  weekScores: ScoreRow[] | undefined
  allPlayers: PlayerRow[] | undefined
  myPlayerId: string | null
}) {
  if (!allPlayers) {
    return <div className="h-40 rounded-xl bg-gray-800 animate-pulse" />
  }

  const playerMap = Object.fromEntries(allPlayers.map((p) => [p._id, p]))
  const scored = (weekScores ?? [])
    .map((s) => ({ player: playerMap[s.playerId], points: s.points }))
    .filter((r): r is { player: PlayerRow; points: number } => !!r.player)
    .sort((a, b) => b.points - a.points)

  const scoredIds = new Set(scored.map((r) => r.player._id))
  const zeroes = allPlayers
    .filter((p) => !scoredIds.has(p._id))
    .map((p) => ({ player: p, points: 0 }))

  const ranked = [...scored, ...zeroes]
  const medals = ['🥇', '🥈', '🥉']
  const top3 = ranked.slice(0, 3)
  const rest = ranked.slice(3)

  return (
    <div className="flex flex-col gap-2">
      {top3.map(({ player, points }, i) => {
        const isMe = player._id === myPlayerId
        const isFirst = i === 0
        // Reveal: 3rd first, 1st last (most dramatic)
        const delay = (2 - i) * 0.13 + 0.1
        return (
          <motion.div
            key={player._id}
            initial={{ opacity: 0, y: 32, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay, duration: 0.38, ease: 'backOut' }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
              isFirst
                ? 'border-yellow-500/60 bg-yellow-900/15 shadow-lg shadow-yellow-900/20'
                : isMe
                  ? 'border-violet-500 bg-violet-900/30'
                  : 'border-gray-700 bg-gray-800/40'
            } ${isMe ? 'ring-1 ring-violet-500/40' : ''}`}
          >
            <span className={`w-8 text-center shrink-0 ${isFirst ? 'text-3xl' : 'text-2xl'}`}>{medals[i]}</span>
            <div
              className={`rounded-full flex items-center justify-center overflow-hidden shrink-0 ${isFirst ? 'w-12 h-12 text-2xl' : 'w-10 h-10 text-xl'}`}
              style={{ backgroundColor: player.color }}
            >
              {player.photoUrl
                ? <img src={player.photoUrl} alt="" className="w-full h-full object-cover" />
                : player.avatar}
            </div>
            <p className={`flex-1 font-bold text-white truncate ${isFirst ? 'text-base' : 'text-sm'}`}>{player.pseudo}</p>
            <p className={`font-black shrink-0 ${isFirst ? 'text-xl text-yellow-400' : 'text-base text-gray-300'}`}>{points} pts</p>
          </motion.div>
        )
      })}

      {rest.length > 0 && (
        <div className="mt-1 flex flex-col gap-1.5">
          {rest.map(({ player, points }, i) => {
            const isMe = player._id === myPlayerId
            return (
              <motion.div
                key={player._id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.05, duration: 0.22 }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
                  isMe ? 'border-violet-600/50 bg-violet-900/20' : 'border-gray-800 bg-gray-800/20'
                }`}
              >
                <span className="text-xs text-gray-500 w-6 text-center shrink-0">#{i + 4}</span>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-base overflow-hidden shrink-0"
                  style={{ backgroundColor: player.color }}
                >
                  {player.photoUrl
                    ? <img src={player.photoUrl} alt="" className="w-full h-full object-cover" />
                    : player.avatar}
                </div>
                <p className="flex-1 text-sm text-gray-300 truncate">{player.pseudo}</p>
                <p className="text-sm font-bold text-gray-400 shrink-0">{points} pts</p>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── CorrectionWatcher ────────────────────────────────────────

type BlockAnswer = {
  _id: string
  playerId: string
  questionNumber: number
  text: string
  points?: number
  player?: { pseudo: string; avatar: string; color: string; photoUrl?: string | null }
}

type BlockQuestion = { number: number; text: string }

function CorrectionWatcher({
  blockQuestions,
  blockAnswers,
  myPlayerId,
  myScore,
}: {
  blockQuestions: BlockQuestion[]
  blockAnswers: BlockAnswer[] | undefined
  myPlayerId: string | null
  myScore: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col gap-5"
    >
      <div className="flex items-center gap-3">
        <motion.p
          className="text-3xl shrink-0"
          animate={{ rotate: [0, -10, 10, -6, 0] }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          📝
        </motion.p>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold text-white">Correction en cours…</p>
          <p className="text-gray-500 text-sm">Le host attribue les points.</p>
        </div>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="px-4 py-2 rounded-xl border border-violet-700 bg-violet-900/20 text-center shrink-0"
        >
          <p className="text-xl font-black text-white">{myScore}</p>
          <p className="text-xs text-gray-400">pts</p>
        </motion.div>
      </div>

      {blockAnswers === undefined ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {blockQuestions.map((q) => {
            const qAnswers = blockAnswers.filter((a) => a.questionNumber === q.number)
            return (
              <div key={q.number} className="flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-mono text-violet-400 shrink-0 mt-0.5">
                    #{q.number}
                  </span>
                  <p className="text-sm font-semibold text-gray-200 leading-snug">{q.text}</p>
                </div>

                {qAnswers.length === 0 ? (
                  <p className="text-xs text-gray-600 italic pl-5">Aucune réponse</p>
                ) : (
                  <div className="flex flex-col gap-1.5 pl-5">
                    <AnimatePresence>
                      {qAnswers.map((a) => {
                        const isMe = a.playerId === myPlayerId
                        const scored = a.points !== undefined
                        return (
                          <motion.div
                            key={a._id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.2 }}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                              isMe
                                ? 'border-violet-600/60 bg-violet-900/20'
                                : scored && a.points! > 0
                                  ? 'border-green-700/40 bg-green-900/10'
                                  : 'border-gray-700/50 bg-gray-800/30'
                            }`}
                          >
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs overflow-hidden shrink-0"
                              style={{ backgroundColor: a.player?.color ?? '#6b7280' }}
                            >
                              {a.player?.photoUrl
                                ? <img src={a.player.photoUrl} alt="" className="w-full h-full object-cover" />
                                : (a.player?.avatar ?? '?')}
                            </div>
                            <span className={`flex-1 truncate ${isMe ? 'text-violet-200' : 'text-gray-300'}`}>
                              {a.text}
                            </span>
                            {scored ? (
                              <span
                                className={`font-bold shrink-0 text-xs ${
                                  a.points! > 0 ? 'text-green-400' : 'text-gray-500'
                                }`}
                              >
                                {a.points} pt{a.points !== 1 ? 's' : ''}
                              </span>
                            ) : (
                              <span className="text-gray-600 text-xs shrink-0">…</span>
                            )}
                          </motion.div>
                        )
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}

// ── Shared shell ──────────────────────────────────────────────

type ShellProps = {
  week: { weekNumber: number; title: string }
  player: { pseudo: string; avatar: string; color: string; photoUrl?: string | null } | null | undefined
  score: number
  children: React.ReactNode
}

function PageShell({ week, player, score, children }: ShellProps) {
  return (
    <main className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">Semaine {week.weekNumber}</p>
          <p className="text-sm font-bold text-white">{week.title}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-lg font-black text-white">{score}</p>
            <p className="text-xs text-gray-500">pts</p>
          </div>
          {player && (
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-lg overflow-hidden shrink-0"
              style={{ backgroundColor: player.color }}
            >
              {player.photoUrl
                ? <img src={player.photoUrl} alt="" className="w-full h-full object-cover" />
                : player.avatar}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        {children}
      </div>
    </main>
  )
}
