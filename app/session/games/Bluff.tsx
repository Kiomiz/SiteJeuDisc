'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar, useCountdown, PlayerLite } from './_shared'

type Option = { key: string; text: string; authorId?: string; isTruth?: boolean }
type Game = {
  _id: Id<'games'>
  type: 'fibbage' | 'quiplash'
  config: { questions?: { text: string; answer: string }[]; prompts?: string[]; durationSec?: number }
  state: { subPhase?: string; roundIndex?: number; deadline?: number; options?: Option[]; tally?: Record<string, number>; rawScores?: Record<string, number> }
}

function promptText(game: Game, round: number): string {
  if (game.type === 'fibbage') return game.config?.questions?.[round]?.text ?? ''
  return game.config?.prompts?.[round] ?? ''
}
function roundTotal(game: Game): number {
  if (game.type === 'fibbage') return game.config?.questions?.length || 1
  return game.config?.prompts?.length || 1
}

// ═══════════════ HOST ═══════════════

export function BluffHost({ game, players, onFinish }: { game: Game; players: PlayerLite[]; onFinish: () => void }) {
  const sub = game.state?.subPhase ?? 'intro'
  const round = game.state?.roundIndex ?? 0
  const total = roundTotal(game)
  const prompt = promptText(game, round)
  const isFibbage = game.type === 'fibbage'

  const answers = useQuery(api.games.roundAnswers, { gameId: game._id, round })
  const votes = useQuery(api.games.roundVotes, { gameId: game._id, round })
  const remaining = useCountdown(game.state?.deadline)

  const startWriting = useMutation(api.bluff.startWriting)
  const openVoting = useMutation(api.bluff.openVoting)
  const reveal = useMutation(api.bluff.reveal)
  const nextRound = useMutation(api.bluff.nextRound)

  // auto-transitions au chrono
  const movedRef = useRef('')
  useEffect(() => {
    if (remaining !== 0) { movedRef.current = ''; return }
    const tag = `${sub}-${round}`
    if (movedRef.current === tag) return
    if (sub === 'writing') { movedRef.current = tag; openVoting({ gameId: game._id }) }
    else if (sub === 'voting') { movedRef.current = tag; reveal({ gameId: game._id }) }
  }, [remaining, sub, round, game._id, openVoting, reveal])

  const label = isFibbage ? '🤥 Fibbage' : '✍️ Quiplash'

  if (sub === 'intro') {
    return (
      <div className="flex flex-col items-center gap-5 py-8 text-center">
        <p className="text-sm text-gray-400">{label} — manche {round + 1} / {total}</p>
        <div className="p-5 rounded-2xl border border-gray-700 bg-gray-800/60 max-w-lg">
          <p className="text-xl font-bold text-white leading-snug">{prompt || '…'}</p>
        </div>
        <p className="text-gray-500 text-sm max-w-sm">{isFibbage ? 'Chacun va inventer une fausse réponse plausible pour piéger les autres.' : 'Chacun écrit sa réponse la plus drôle, puis on vote.'}</p>
        <button onClick={() => startWriting({ gameId: game._id })} className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold transition-colors">▶ Lancer l&apos;écriture</button>
      </div>
    )
  }

  if (sub === 'writing') {
    const writtenIds = new Set<string>((answers ?? []).filter((a) => a.value.trim()).map((a) => a.playerId))
    const textMap: Record<string, string> = Object.fromEntries((answers ?? []).map((a) => [a.playerId, a.value]))
    return (
      <div className="flex flex-col items-center gap-5 py-6">
        <div className="flex items-center justify-between w-full max-w-lg">
          <span className="text-sm text-gray-400">{label}</span>
          <span className={`text-3xl font-black tabular-nums ${remaining !== null && remaining <= 10 ? 'text-red-400' : 'text-white'}`}>{remaining ?? '—'}</span>
        </div>
        <div className="p-4 rounded-2xl border border-gray-700 bg-gray-800/60 max-w-lg"><p className="text-lg font-bold text-white text-center">{prompt}</p></div>
        <p className="text-sm text-gray-400">{writtenIds.size} / {players.length} ont écrit (visible host)</p>
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
        <button onClick={() => openVoting({ gameId: game._id })} className="px-5 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold transition-colors">Passer au vote →</button>
      </div>
    )
  }

  if (sub === 'voting') {
    const options = game.state?.options ?? []
    const votedCount = votes?.length ?? 0
    return (
      <div className="flex flex-col items-center gap-5 py-4">
        <div className="flex items-center justify-between w-full max-w-lg">
          <span className="text-sm text-gray-400">Votez sur vos téléphones</span>
          <span className={`text-3xl font-black tabular-nums ${remaining !== null && remaining <= 10 ? 'text-red-400' : 'text-white'}`}>{remaining ?? '—'}</span>
        </div>
        <div className="p-4 rounded-2xl border border-gray-700 bg-gray-800/60 max-w-lg"><p className="text-lg font-bold text-white text-center">{prompt}</p></div>
        <div className="flex flex-col gap-2 max-w-lg w-full">
          {options.map((o) => (
            <div key={o.key} className="px-4 py-3 rounded-xl border border-gray-700 bg-gray-800/40 text-white font-medium">{o.text}</div>
          ))}
        </div>
        <p className="text-sm text-gray-400">{votedCount} / {players.length} ont voté</p>
        <button onClick={() => reveal({ gameId: game._id })} className="px-5 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold transition-colors">⏹ Révéler</button>
      </div>
    )
  }

  if (sub === 'reveal') {
    const options = game.state?.options ?? []
    const tally = game.state?.tally ?? {}
    const playerMap = Object.fromEntries(players.map((p) => [p._id, p]))
    const sorted = [...options].sort((a, b) => (tally[b.key] ?? 0) - (tally[a.key] ?? 0))
    const isLast = round + 1 >= total
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <p className="text-lg font-bold text-white text-center max-w-lg">{prompt}</p>
        <div className="flex flex-col gap-2 max-w-lg w-full">
          {sorted.map((o) => (
            <motion.div key={o.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${o.isTruth ? 'border-green-600/60 bg-green-900/15' : 'border-gray-700 bg-gray-800/40'}`}>
              {o.isTruth ? <span className="text-lg shrink-0">✅</span> : <Avatar p={playerMap[o.authorId ?? '']} size={26} />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{o.text}</p>
                <p className="text-xs text-gray-500">{o.isTruth ? 'LA VÉRITÉ' : (playerMap[o.authorId ?? '']?.pseudo ?? '?')}</p>
              </div>
              <span className="text-sm font-black text-violet-300 shrink-0">{tally[o.key] ?? 0} vote{(tally[o.key] ?? 0) !== 1 ? 's' : ''}</span>
            </motion.div>
          ))}
        </div>
        {isLast ? (
          <button onClick={onFinish} className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold transition-colors">✓ Terminer {label}</button>
        ) : (
          <button onClick={() => nextRound({ gameId: game._id })} className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold transition-colors">Manche suivante →</button>
        )}
      </div>
    )
  }
  return null
}

// ═══════════════ JOUEUR ═══════════════

export function BluffPlayer({ game, playerId }: { game: Game; playerId: Id<'players'> }) {
  const sub = game.state?.subPhase ?? 'intro'
  const round = game.state?.roundIndex ?? 0
  const prompt = promptText(game, round)
  const isFibbage = game.type === 'fibbage'
  const remaining = useCountdown(game.state?.deadline)

  const myAnswers = useQuery(api.games.myRoundAnswers, { gameId: game._id, round, playerId })
  const myVote = useQuery(api.games.myVote, { gameId: game._id, round, playerId })
  const submitWriting = useMutation(api.bluff.submitWriting)
  const submitVote = useMutation(api.bluff.submitVote)

  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => { setText(''); setErr('') }, [round])
  useEffect(() => {
    const v = myAnswers?.[0]?.value
    if (v !== undefined) setText((prev) => (prev === '' ? v : prev))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, myAnswers?.length])

  function onChangeText(val: string) {
    setText(val); setErr('')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      submitWriting({ gameId: game._id, playerId, value: val }).catch((e) => setErr(e instanceof Error ? e.message : 'Erreur'))
    }, 500)
  }

  if (sub === 'intro') {
    return <div className="flex flex-col items-center gap-3 py-12 text-center"><p className="text-3xl">{isFibbage ? '🤥' : '✍️'}</p><p className="text-white font-bold">{isFibbage ? 'Fibbage' : 'Quiplash'}</p><p className="text-gray-300 text-sm max-w-xs">{prompt}</p><p className="text-gray-500 text-xs">Prépare-toi…</p></div>
  }

  if (sub === 'writing') {
    return (
      <div className="flex flex-col gap-4 py-4">
        <div className="flex items-center justify-between"><span className="text-xs text-gray-500">Manche {round + 1}</span><span className={`text-2xl font-black tabular-nums ${remaining !== null && remaining <= 10 ? 'text-red-400' : 'text-white'}`}>{remaining ?? '—'}</span></div>
        <div className="p-4 rounded-xl border border-gray-700 bg-gray-800/60"><p className="font-bold text-white">{prompt}</p></div>
        <p className="text-sm text-violet-300">{isFibbage ? '🤥 Invente une FAUSSE réponse crédible' : '😂 Ta réponse la plus drôle'}</p>
        <textarea
          value={text}
          onChange={(e) => onChangeText(e.target.value)}
          rows={2}
          placeholder={isFibbage ? 'Ton mensonge…' : 'Ta vanne…'}
          className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-violet-500 transition-colors resize-none"
        />
        {err && <p className="text-red-400 text-sm">{err}</p>}
        <p className="text-center text-xs text-gray-600">Enregistré automatiquement.</p>
      </div>
    )
  }

  if (sub === 'voting') {
    const options = (game.state?.options ?? []).filter((o) => o.authorId !== playerId)
    return (
      <div className="flex flex-col gap-3 py-4">
        <div className="flex items-center justify-between"><span className="text-sm text-violet-300 font-semibold">{isFibbage ? '🎯 Trouve la VRAIE réponse' : '🗳️ Vote la meilleure'}</span><span className={`text-2xl font-black tabular-nums ${remaining !== null && remaining <= 10 ? 'text-red-400' : 'text-white'}`}>{remaining ?? '—'}</span></div>
        <div className="p-3 rounded-xl border border-gray-700 bg-gray-800/60"><p className="text-sm font-bold text-white">{prompt}</p></div>
        <div className="flex flex-col gap-2">
          {options.map((o) => {
            const selected = myVote === o.key
            return (
              <button key={o.key} onClick={() => submitVote({ gameId: game._id, playerId, targetKey: o.key }).catch(() => {})}
                className={`px-4 py-3 rounded-xl border text-left font-medium transition-colors ${selected ? 'border-violet-500 bg-violet-900/30 text-white' : 'border-gray-700 bg-gray-800/40 text-gray-200 hover:border-gray-600'}`}>
                {selected ? '✓ ' : ''}{o.text}
              </button>
            )
          })}
        </div>
        {myVote && <p className="text-center text-xs text-green-400">Vote enregistré — tu peux changer.</p>}
      </div>
    )
  }

  if (sub === 'reveal') {
    const myPts = game.state?.rawScores?.[playerId] ?? 0
    const truth = game.state?.options?.find((o) => o.isTruth)
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        {isFibbage && truth && <><p className="text-gray-400 text-sm">La vérité était</p><p className="text-lg font-black text-green-300">{truth.text}</p></>}
        <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="px-8 py-4 rounded-2xl border border-violet-700 bg-violet-900/20 mt-2">
          <p className="text-4xl font-black text-white">{myPts}</p>
          <p className="text-xs text-gray-400">total {isFibbage ? 'Fibbage' : 'Quiplash'}</p>
        </motion.div>
        <AnimatePresence />
      </div>
    )
  }
  return null
}
