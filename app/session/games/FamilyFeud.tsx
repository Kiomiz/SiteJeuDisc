'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { motion } from 'framer-motion'
import { Avatar, useCountdown, PointsPicker, PlayerLite } from './_shared'

type SurveyAnswer = { text: string; count: number }
type Game = {
  _id: Id<'games'>
  config: { surveys?: { question: string; answers: SurveyAnswer[] }[]; durationSec?: number }
  state: { subPhase?: string; roundIndex?: number; deadline?: number; rawScores?: Record<string, number> }
}

function survey(game: Game, round: number) { return game.config?.surveys?.[round] }
function total(game: Game) { return game.config?.surveys?.length || 1 }

// ═══════════════ HOST ═══════════════

export function FamilyFeudHost({ game, players, onFinish }: { game: Game; players: PlayerLite[]; onFinish: () => void }) {
  const sub = game.state?.subPhase ?? 'intro'
  const round = game.state?.roundIndex ?? 0
  const sv = survey(game, round)
  const answers = useQuery(api.games.roundAnswers, { gameId: game._id, round })
  const remaining = useCountdown(game.state?.deadline)

  const startWriting = useMutation(api.familyfeud.startWriting)
  const openCorrection = useMutation(api.familyfeud.openCorrection)
  const setMatch = useMutation(api.familyfeud.setMatch)
  const setAnswerPoints = useMutation(api.games.setAnswerPoints)
  const scoreRound = useMutation(api.familyfeud.scoreRound)
  const nextRound = useMutation(api.familyfeud.nextRound)

  const movedRef = useRef('')
  useEffect(() => {
    if (remaining !== 0) { movedRef.current = ''; return }
    const tag = `writing-${round}`
    if (sub === 'writing' && movedRef.current !== tag) { movedRef.current = tag; openCorrection({ gameId: game._id }) }
  }, [remaining, sub, round, game._id, openCorrection])

  const playerMap = Object.fromEntries(players.map((p) => [p._id, p]))
  const sortedSurvey = [...(sv?.answers ?? [])].sort((a, b) => b.count - a.count)

  if (sub === 'intro') {
    return (
      <div className="flex flex-col items-center gap-5 py-10 text-center">
        <p className="text-sm text-gray-400">📊 Une Famille en Or — {round + 1} / {total(game)}</p>
        <div className="p-5 rounded-2xl border border-gray-700 bg-gray-800/60 max-w-lg"><p className="text-xl font-bold text-white">{sv?.question}</p></div>
        <p className="text-gray-500 text-sm">Trouvez les réponses les plus données par le sondage.</p>
        <button onClick={() => startWriting({ gameId: game._id })} className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold transition-colors">▶ Lancer</button>
      </div>
    )
  }

  if (sub === 'writing') {
    const writtenIds = new Set<string>((answers ?? []).filter((a) => a.value.trim()).map((a) => a.playerId))
    const textMap: Record<string, string> = Object.fromEntries((answers ?? []).map((a) => [a.playerId, a.value]))
    return (
      <div className="flex flex-col items-center gap-5 py-6">
        <span className={`text-4xl font-black tabular-nums ${remaining !== null && remaining <= 5 ? 'text-red-400' : 'text-white'}`}>{remaining ?? '—'}</span>
        <div className="p-4 rounded-2xl border border-gray-700 bg-gray-800/60 max-w-lg"><p className="text-lg font-bold text-white text-center">{sv?.question}</p></div>
        <p className="text-sm text-gray-400">{writtenIds.size} / {players.length} ont répondu (visible host)</p>
        <div className="flex flex-col gap-1.5 w-full max-w-lg">
          {players.map((p) => {
            const t = textMap[p._id]?.trim()
            return (
              <div key={p._id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 bg-gray-800/40">
                <Avatar p={p} size={22} />
                <span className="text-xs text-gray-500 shrink-0 w-20 truncate">{p.pseudo}</span>
                <span className={`flex-1 text-sm truncate ${t ? 'text-white' : 'text-gray-600'}`}>{t || '…'}</span>
              </div>
            )
          })}
        </div>
        <button onClick={() => openCorrection({ gameId: game._id })} className="px-5 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold transition-colors">Passer à la correction →</button>
      </div>
    )
  }

  if (sub === 'correction') {
    const guesses = (answers ?? []).filter((a) => a.value.trim())
    return (
      <div className="flex flex-col gap-4 py-2">
        <p className="text-center text-lg font-bold text-white">📝 Associe chaque réponse</p>
        <p className="text-center text-xs text-gray-500 max-w-md mx-auto">{sv?.question} — associe au sondage (points auto), ou fixe des points à la main pour une bonne réponse imprévue.</p>
        <div className="flex flex-col gap-3 max-w-lg mx-auto w-full">
          {guesses.map((a) => (
            <div key={a._id} className="flex flex-col gap-2 p-3 rounded-xl border border-gray-700 bg-gray-800/40">
              <div className="flex items-center gap-2">
                <Avatar p={playerMap[a.playerId]} size={22} />
                <span className="text-xs text-gray-400">{playerMap[a.playerId]?.pseudo}</span>
                <span className="text-sm font-bold text-white flex-1">« {a.value} »</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sortedSurvey.map((ans) => {
                  const sel = a.matchedKey === ans.text
                  return (
                    <button key={ans.text} onClick={() => setMatch({ answerId: a._id, matchedKey: sel ? '' : ans.text })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${sel ? 'border-green-500 bg-green-900/30 text-green-200' : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500'}`}>
                      {ans.text} <span className="opacity-60">({ans.count})</span>
                    </button>
                  )
                })}
                <button onClick={() => setMatch({ answerId: a._id, matchedKey: '' })}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${!a.matchedKey ? 'border-red-500/60 bg-red-900/20 text-red-300' : 'border-gray-700 bg-gray-800/40 text-gray-500'}`}>
                  ✕ rien
                </button>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-gray-700/50">
                <span className="text-xs text-gray-500">Points :</span>
                <PointsPicker value={a.points ?? 0} onSet={(n) => setAnswerPoints({ answerId: a._id, points: n })} options={[0]} />
                <span className="text-xs text-gray-600">(ajuste à la main si besoin)</span>
              </div>
            </div>
          ))}
          {guesses.length === 0 && <p className="text-gray-600 text-sm italic text-center">Aucune réponse.</p>}
        </div>
        <button onClick={() => scoreRound({ gameId: game._id })} className="mx-auto px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold transition-colors">Calculer les scores →</button>
      </div>
    )
  }

  if (sub === 'results') {
    const ranked = [...players].map((p) => ({ p, pts: game.state?.rawScores?.[p._id] ?? 0 })).sort((a, b) => b.pts - a.pts)
    const isLast = round + 1 >= total(game)
    return (
      <div className="flex flex-col items-center gap-5 py-4">
        <p className="text-lg font-bold text-white">Le sondage disait…</p>
        <div className="flex flex-col gap-1.5 max-w-md w-full">
          {sortedSurvey.map((ans, i) => (
            <div key={ans.text} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-700 bg-gray-800/40">
              <span className="text-xs text-gray-500 w-4">{i + 1}</span>
              <span className="flex-1 text-sm text-white">{ans.text}</span>
              <span className="text-sm font-black text-yellow-400">{ans.count}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 max-w-md w-full mt-2">
          {ranked.map(({ p, pts }, i) => (
            <div key={p._id} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-gray-700 bg-gray-800/40">
              <span className="text-xs text-gray-500 w-5 text-center">#{i + 1}</span>
              <Avatar p={p} size={26} />
              <span className="flex-1 text-sm text-white truncate">{p.pseudo}</span>
              <span className="text-sm font-black text-violet-300">{pts} pts</span>
            </div>
          ))}
        </div>
        {isLast ? (
          <button onClick={onFinish} className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold transition-colors">✓ Terminer</button>
        ) : (
          <button onClick={() => nextRound({ gameId: game._id })} className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold transition-colors">Sondage suivant →</button>
        )}
      </div>
    )
  }
  return null
}

// ═══════════════ JOUEUR ═══════════════

export function FamilyFeudPlayer({ game, playerId }: { game: Game; playerId: Id<'players'> }) {
  const sub = game.state?.subPhase ?? 'intro'
  const round = game.state?.roundIndex ?? 0
  const sv = survey(game, round)
  const remaining = useCountdown(game.state?.deadline)

  const myAnswers = useQuery(api.games.myRoundAnswers, { gameId: game._id, round, playerId })
  const submitGuess = useMutation(api.familyfeud.submitGuess)
  // En correction, le joueur voit l'association faite par le host en direct (lecture seule).
  const allAnswers = useQuery(
    api.games.roundAnswers,
    sub === 'correction' ? { gameId: game._id, round } : 'skip',
  )

  const [text, setText] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => { setText('') }, [round])
  useEffect(() => {
    const v = myAnswers?.[0]?.value
    if (v !== undefined) setText((prev) => (prev === '' ? v : prev))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, myAnswers?.length])

  function onChange(val: string) {
    setText(val)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { submitGuess({ gameId: game._id, playerId, value: val }).catch(() => {}) }, 500)
  }

  if (sub === 'intro') return <div className="flex flex-col items-center gap-3 py-12 text-center"><p className="text-3xl">📊</p><p className="text-gray-300 text-sm max-w-xs">{sv?.question}</p><p className="text-gray-500 text-xs">Prépare-toi…</p></div>

  if (sub === 'writing') {
    return (
      <div className="flex flex-col gap-4 py-4">
        <div className="flex items-center justify-between"><span className="text-xs text-gray-500">Sondage {round + 1}</span><span className={`text-2xl font-black tabular-nums ${remaining !== null && remaining <= 5 ? 'text-red-400' : 'text-white'}`}>{remaining ?? '—'}</span></div>
        <div className="p-4 rounded-xl border border-gray-700 bg-gray-800/60"><p className="font-bold text-white">{sv?.question}</p></div>
        <input value={text} onChange={(e) => onChange(e.target.value)} placeholder="Ta réponse…" autoComplete="off"
          className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-violet-500 transition-colors" />
        <p className="text-center text-xs text-gray-600">Vise la réponse la plus populaire !</p>
      </div>
    )
  }

  if (sub === 'correction') {
    return (
      <div className="flex flex-col gap-4 py-4">
        <div className="text-center"><p className="text-white font-bold text-lg">📝 Correction</p><p className="text-gray-500 text-sm">Le host associe les réponses — lecture seule.</p></div>
        {allAnswers === undefined ? (
          <div className="h-32 rounded-xl bg-gray-800 animate-pulse" />
        ) : (
          <div className="flex flex-col gap-2">
            {allAnswers.filter((a) => a.value.trim()).map((a) => {
              const mine = a.playerId === playerId
              return (
                <div key={a._id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${mine ? 'border-violet-500/60 bg-violet-900/20' : 'border-gray-700 bg-gray-800/40'}`}>
                  <Avatar p={a.player} size={22} />
                  <span className="flex-1 text-sm text-white truncate">« {a.value} »</span>
                  {(a.points ?? 0) > 0 || a.matchedKey ? (
                    <span className="text-xs text-green-300 shrink-0">{a.matchedKey ? `→ ${a.matchedKey} ` : ''}+{a.points ?? 0}</span>
                  ) : (
                    <span className="text-xs text-gray-600 shrink-0">…</span>
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
        <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="px-8 py-4 rounded-2xl border border-violet-700 bg-violet-900/20">
          <p className="text-4xl font-black text-white">{myPts}</p><p className="text-xs text-gray-400">total</p>
        </motion.div>
        <p className="text-gray-500 text-sm">Regarde l&apos;écran principal 👀</p>
      </div>
    )
  }
  return null
}
