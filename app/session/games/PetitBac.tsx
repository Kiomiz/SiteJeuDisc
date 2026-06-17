'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { motion } from 'framer-motion'
import { Avatar, useCountdown, PointsPicker, PlayerLite } from './_shared'

type Game = {
  _id: Id<'games'>
  config: { categories?: string[]; durationSec?: number }
  state: { subPhase?: string; roundIndex?: number; letter?: string; deadline?: number; rawScores?: Record<string, number> }
}

// ═══════════════ HOST ═══════════════

export function PetitBacHost({ game, players, onFinish }: { game: Game; players: PlayerLite[]; onFinish: () => void }) {
  const sub = game.state?.subPhase ?? 'intro'
  const roundIndex = game.state?.roundIndex ?? 0
  const letter = game.state?.letter
  const categories = game.config?.categories ?? []

  const startRound = useMutation(api.petitbac.startRound)
  const endRound = useMutation(api.petitbac.endRound)
  const scoreRound = useMutation(api.petitbac.scoreRound)
  const newRound = useMutation(api.petitbac.newRound)

  const answers = useQuery(api.games.roundAnswers, { gameId: game._id, round: roundIndex })
  const remaining = useCountdown(game.state?.deadline)

  // auto-fermeture quand le chrono atteint 0
  const endedRef = useRef(false)
  useEffect(() => {
    if (sub !== 'playing') { endedRef.current = false; return }
    if (remaining === 0 && !endedRef.current) {
      endedRef.current = true
      endRound({ gameId: game._id })
    }
  }, [sub, remaining, game._id, endRound])

  if (categories.length === 0) {
    return <p className="text-gray-400 text-center py-8">Petit Bac : aucune catégorie configurée.</p>
  }

  // ── INTRO ── (la lettre est une surprise, révélée au lancement)
  if (sub === 'intro') {
    return (
      <div className="flex flex-col items-center gap-6 py-8 text-center">
        <p className="text-sm text-gray-400">Manche {roundIndex + 1}</p>
        <p className="text-lg font-bold text-white">🔤 Petit Bac</p>
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="w-28 h-28 rounded-3xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-900/40">
          <span className="text-6xl font-black text-white">?</span>
        </motion.div>
        <div className="flex flex-wrap gap-2 justify-center max-w-md">
          {categories.map((c) => (
            <span key={c} className="px-3 py-1 rounded-full bg-gray-800 border border-gray-700 text-sm text-gray-300">{c}</span>
          ))}
        </div>
        <button onClick={() => startRound({ gameId: game._id })} className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold transition-colors">
          ▶ Lancer (lettre surprise)
        </button>
      </div>
    )
  }

  // ── PLAYING ──
  if (sub === 'playing') {
    // réponses live de chaque joueur, par catégorie
    const byPlayer: Record<string, Record<string, string>> = {}
    for (const a of answers ?? []) {
      if (!a.value.trim() || !a.slot) continue
      byPlayer[a.playerId] ??= {}
      byPlayer[a.playerId][a.slot] = a.value
    }
    return (
      <div className="flex flex-col items-center gap-5 py-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-violet-600 flex items-center justify-center">
            <span className="text-2xl font-black text-white">{(letter ?? '?').toUpperCase()}</span>
          </div>
          <div className={`text-5xl font-black tabular-nums ${remaining !== null && remaining <= 10 ? 'text-red-400' : 'text-white'}`}>
            {remaining ?? '—'}
          </div>
        </div>
        <p className="text-sm text-gray-400">Réponses en direct (visible host)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
          {players.map((p) => {
            const mine = byPlayer[p._id] ?? {}
            const count = Object.keys(mine).length
            return (
              <div key={p._id} className="rounded-xl border border-gray-700 bg-gray-800/40 p-3 flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <Avatar p={p} size={22} />
                  <span className="text-sm font-bold text-white truncate flex-1">{p.pseudo}</span>
                  <span className={`text-xs font-bold ${count === categories.length ? 'text-green-400' : 'text-gray-500'}`}>{count}/{categories.length}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {categories.map((cat) => {
                    const v = mine[cat]
                    return v ? (
                      <div key={cat} className="text-xs truncate">
                        <span className="text-gray-500">{cat} : </span>
                        <span className="text-white font-medium">{v}</span>
                      </div>
                    ) : null
                  })}
                  {count === 0 && <span className="text-xs text-gray-600 italic">en attente…</span>}
                </div>
              </div>
            )
          })}
        </div>
        <button onClick={() => endRound({ gameId: game._id })} className="px-5 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold transition-colors">
          ⏹ Terminer maintenant
        </button>
      </div>
    )
  }

  // ── CORRECTION ──
  if (sub === 'correction') {
    return <PetitBacCorrection game={game} letter={letter ?? ''} categories={categories} answers={answers} onScore={() => scoreRound({ gameId: game._id })} />
  }

  // ── RESULTS ──
  if (sub === 'results') {
    const raw = game.state?.rawScores ?? {}
    const ranked = [...players].map((p) => ({ p, pts: raw[p._id] ?? 0 })).sort((a, b) => b.pts - a.pts)
    return (
      <div className="flex flex-col gap-5 py-4">
        <p className="text-center text-lg font-bold text-white">Résultats — manche {roundIndex + 1} (lettre {(letter ?? '?').toUpperCase()})</p>
        <div className="flex flex-col gap-2 max-w-md mx-auto w-full">
          {ranked.map(({ p, pts }, i) => (
            <div key={p._id} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-gray-700 bg-gray-800/40">
              <span className="text-xs text-gray-500 w-5 text-center">#{i + 1}</span>
              <Avatar p={p} size={28} />
              <span className="flex-1 text-sm text-white font-medium truncate">{p.pseudo}</span>
              <span className="text-sm font-black text-violet-300">{pts} pts</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          <button onClick={() => newRound({ gameId: game._id })} className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold transition-colors">
            🔁 Relancer une manche
          </button>
          <button onClick={onFinish} className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold transition-colors">
            ✓ Terminer le Petit Bac
          </button>
        </div>
      </div>
    )
  }

  return null
}

type RoundAnswer = {
  _id: Id<'gameAnswers'>
  playerId: string
  slot?: string
  value: string
  points?: number
  player?: PlayerLite | null
}

function PetitBacCorrection({ letter, categories, answers, onScore }: { game: Game; letter: string; categories: string[]; answers: RoundAnswer[] | undefined; onScore: () => void }) {
  const setAnswerPoints = useMutation(api.games.setAnswerPoints)
  if (answers === undefined) return <div className="h-40 rounded-xl bg-gray-800 animate-pulse" />

  return (
    <div className="flex flex-col gap-5 py-2">
      <p className="text-center text-lg font-bold text-white">📝 Correction — lettre {letter.toUpperCase()}</p>
      <p className="text-center text-xs text-gray-500 max-w-md mx-auto">Points pré-remplis (unique = 2, partagé = 1). Ajuste à la main : <b>0</b> pour refuser, ou un autre nombre pour une bonne réponse imprévue.</p>
      <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full">
        {categories.map((cat) => {
          const catAnswers = (answers ?? []).filter((a) => a.slot === cat && a.value.trim())
          return (
            <div key={cat} className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{cat}</p>
              {catAnswers.length === 0 ? (
                <p className="text-xs text-gray-600 italic pl-1">Personne</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {catAnswers.map((a) => (
                    <div key={a._id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border ${(a.points ?? 0) === 0 ? 'border-red-700/40 bg-red-900/10' : 'border-gray-700 bg-gray-800/40'}`}>
                      <Avatar p={a.player} size={20} />
                      <span className={`flex-1 text-sm truncate ${(a.points ?? 0) === 0 ? 'text-red-300 line-through' : 'text-white'}`}>{a.value}</span>
                      <PointsPicker value={a.points ?? 0} onSet={(n) => setAnswerPoints({ answerId: a._id, points: n })} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <button onClick={onScore} className="mx-auto px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold transition-colors">
        ✓ Valider les scores →
      </button>
    </div>
  )
}

// ═══════════════ JOUEUR ═══════════════

export function PetitBacPlayer({ game, playerId }: { game: Game; playerId: Id<'players'> }) {
  const sub = game.state?.subPhase ?? 'intro'
  const roundIndex = game.state?.roundIndex ?? 0
  const letter = game.state?.letter
  const categories = game.config?.categories ?? []
  const remaining = useCountdown(game.state?.deadline)

  const myAnswers = useQuery(api.games.myRoundAnswers, { gameId: game._id, round: roundIndex, playerId })
  const submitWord = useMutation(api.petitbac.submitWord)
  // Pendant la correction, le joueur voit toutes les réponses en lecture seule (live).
  const allAnswers = useQuery(
    api.games.roundAnswers,
    sub === 'correction' ? { gameId: game._id, round: roundIndex } : 'skip',
  )

  const [values, setValues] = useState<Record<string, string>>({})
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // réinitialise à chaque nouvelle manche
  useEffect(() => { setValues({}) }, [roundIndex])
  // pré-remplit depuis le serveur
  useEffect(() => {
    if (!myAnswers) return
    const next: Record<string, string> = {}
    for (const a of myAnswers) if (a.slot) next[a.slot] = a.value
    setValues((prev) => ({ ...next, ...prev }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundIndex, myAnswers?.length])

  function onChange(slot: string, value: string) {
    setValues((v) => ({ ...v, [slot]: value }))
    clearTimeout(timers.current[slot])
    timers.current[slot] = setTimeout(() => {
      submitWord({ gameId: game._id, playerId, slot, value }).catch(() => {})
    }, 500)
  }

  if (categories.length === 0) return <p className="text-gray-400 text-center py-8">En attente…</p>

  if (sub === 'intro') {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <p className="text-gray-400 text-sm">Prépare-toi…</p>
        <div className="w-24 h-24 rounded-3xl bg-violet-600 flex items-center justify-center">
          <span className="text-5xl font-black text-white">?</span>
        </div>
        <p className="text-white font-bold">Petit Bac — manche {roundIndex + 1}</p>
        <p className="text-gray-500 text-sm">La lettre est une surprise !</p>
      </div>
    )
  }

  if (sub === 'playing') {
    return (
      <div className="flex flex-col gap-4 py-4">
        <div className="flex items-center justify-between sticky top-0 bg-gray-950 py-2 z-10">
          <div className="w-12 h-12 rounded-xl bg-violet-600 flex items-center justify-center">
            <span className="text-2xl font-black text-white">{(letter ?? '?').toUpperCase()}</span>
          </div>
          <span className={`text-3xl font-black tabular-nums ${remaining !== null && remaining <= 10 ? 'text-red-400' : 'text-white'}`}>{remaining ?? '—'}</span>
        </div>
        {categories.map((cat) => (
          <div key={cat} className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{cat}</label>
            <input
              value={values[cat] ?? ''}
              onChange={(e) => onChange(cat, e.target.value)}
              placeholder={`En ${(letter ?? '?').toUpperCase()}…`}
              autoComplete="off"
              className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>
        ))}
        <p className="text-center text-xs text-gray-600">Tes réponses sont enregistrées automatiquement.</p>
      </div>
    )
  }

  if (sub === 'correction') {
    return (
      <div className="flex flex-col gap-4 py-4">
        <div className="text-center">
          <p className="text-white font-bold text-lg">📝 Correction (lettre {(letter ?? '?').toUpperCase()})</p>
          <p className="text-gray-500 text-sm">Le host valide — tu ne peux pas intervenir.</p>
        </div>
        {allAnswers === undefined ? (
          <div className="h-32 rounded-xl bg-gray-800 animate-pulse" />
        ) : (
          <div className="flex flex-col gap-3">
            {categories.map((cat) => {
              const catAnswers = allAnswers.filter((a) => a.slot === cat && a.value.trim())
              return (
                <div key={cat} className="flex flex-col gap-1.5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{cat}</p>
                  {catAnswers.length === 0 ? (
                    <p className="text-xs text-gray-600 italic pl-1">Personne</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {catAnswers.map((a) => {
                        const pts = a.points ?? 0
                        const refused = pts === 0
                        const mine = a.playerId === playerId
                        return (
                          <div key={a._id} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-sm ${refused ? 'border-red-600/60 bg-red-900/20 line-through text-red-300' : mine ? 'border-violet-500/60 bg-violet-900/20 text-white' : 'border-gray-700 bg-gray-800/60 text-gray-200'}`}>
                            <Avatar p={a.player} size={18} />
                            {a.value}
                            <span className={`text-xs font-bold ${refused ? 'text-red-400' : 'text-green-400'}`}>+{pts}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  if (sub === 'results') {
    const myPts = game.state?.rawScores?.[playerId] ?? 0
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-gray-400 text-sm">Manche {roundIndex + 1} terminée</p>
        <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="px-8 py-5 rounded-2xl border border-violet-700 bg-violet-900/20">
          <p className="text-4xl font-black text-white">{myPts}</p>
          <p className="text-xs text-gray-400">total Petit Bac</p>
        </motion.div>
      </div>
    )
  }

  return null
}
