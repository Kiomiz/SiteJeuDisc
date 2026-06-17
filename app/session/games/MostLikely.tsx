'use client'

import { useEffect, useRef } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { motion } from 'framer-motion'
import { Avatar, useCountdown, PlayerLite } from './_shared'

type Game = {
  _id: Id<'games'>
  config: { prompts?: string[] }
  state: { subPhase?: string; roundIndex?: number; deadline?: number; tally?: Record<string, number>; rawScores?: Record<string, number> }
}

function prompt(game: Game, round: number) { return game.config?.prompts?.[round] ?? '' }
function total(game: Game) { return game.config?.prompts?.length || 1 }

// ═══════════════ HOST ═══════════════

export function MostLikelyHost({ game, players, onFinish }: { game: Game; players: PlayerLite[]; onFinish: () => void }) {
  const sub = game.state?.subPhase ?? 'intro'
  const round = game.state?.roundIndex ?? 0
  const votes = useQuery(api.games.roundVotes, { gameId: game._id, round })
  const remaining = useCountdown(game.state?.deadline)

  const startVoting = useMutation(api.mostlikely.startVoting)
  const reveal = useMutation(api.mostlikely.reveal)
  const nextRound = useMutation(api.mostlikely.nextRound)

  const movedRef = useRef('')
  useEffect(() => {
    if (remaining !== 0) { movedRef.current = ''; return }
    const tag = `${sub}-${round}`
    if (sub === 'voting' && movedRef.current !== tag) { movedRef.current = tag; reveal({ gameId: game._id }) }
  }, [remaining, sub, round, game._id, reveal])

  if (sub === 'intro') {
    return (
      <div className="flex flex-col items-center gap-5 py-10 text-center">
        <p className="text-sm text-gray-400">🫵 Qui est le + susceptible — {round + 1} / {total(game)}</p>
        <div className="p-5 rounded-2xl border border-gray-700 bg-gray-800/60 max-w-lg"><p className="text-xl font-bold text-white">{prompt(game, round)}</p></div>
        <button onClick={() => startVoting({ gameId: game._id })} className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold transition-colors">▶ Lancer le vote</button>
      </div>
    )
  }

  if (sub === 'voting') {
    return (
      <div className="flex flex-col items-center gap-5 py-6">
        <span className={`text-4xl font-black tabular-nums ${remaining !== null && remaining <= 5 ? 'text-red-400' : 'text-white'}`}>{remaining ?? '—'}</span>
        <div className="p-4 rounded-2xl border border-gray-700 bg-gray-800/60 max-w-lg"><p className="text-lg font-bold text-white text-center">{prompt(game, round)}</p></div>
        <p className="text-sm text-gray-400">{votes?.length ?? 0} / {players.length} ont voté — sur vos téléphones 👀</p>
        <button onClick={() => reveal({ gameId: game._id })} className="px-5 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold transition-colors">⏹ Révéler</button>
      </div>
    )
  }

  if (sub === 'reveal') {
    const tally = game.state?.tally ?? {}
    const ranked = [...players].map((p) => ({ p, c: tally[p._id] ?? 0 })).sort((a, b) => b.c - a.c)
    const max = ranked[0]?.c ?? 0
    const isLast = round + 1 >= total(game)
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <p className="text-lg font-bold text-white text-center max-w-lg">{prompt(game, round)}</p>
        <div className="flex flex-col gap-2 max-w-md w-full">
          {ranked.map(({ p, c }, i) => (
            <motion.div key={p._id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${c === max && max > 0 ? 'border-violet-500/70 bg-violet-900/25' : 'border-gray-700 bg-gray-800/40'}`}>
              <span className="w-6 text-center shrink-0">{c === max && max > 0 ? '👑' : ''}</span>
              <Avatar p={p} size={30} />
              <span className="flex-1 text-sm text-white font-medium truncate">{p.pseudo}</span>
              <span className="text-sm font-black text-violet-300 shrink-0">{c} vote{c !== 1 ? 's' : ''}</span>
            </motion.div>
          ))}
        </div>
        {isLast ? (
          <button onClick={onFinish} className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold transition-colors">✓ Terminer</button>
        ) : (
          <button onClick={() => nextRound({ gameId: game._id })} className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold transition-colors">Question suivante →</button>
        )}
      </div>
    )
  }
  return null
}

// ═══════════════ JOUEUR ═══════════════

export function MostLikelyPlayer({ game, playerId, players }: { game: Game; playerId: Id<'players'>; players: PlayerLite[] }) {
  const sub = game.state?.subPhase ?? 'intro'
  const round = game.state?.roundIndex ?? 0
  const remaining = useCountdown(game.state?.deadline)
  const myVote = useQuery(api.games.myVote, { gameId: game._id, round, playerId })
  const submitVote = useMutation(api.mostlikely.submitVote)

  if (sub === 'intro') {
    return <div className="flex flex-col items-center gap-3 py-12 text-center"><p className="text-3xl">🫵</p><p className="text-gray-300 text-sm max-w-xs">{prompt(game, round)}</p><p className="text-gray-500 text-xs">Prépare ton jugement…</p></div>
  }

  if (sub === 'voting') {
    return (
      <div className="flex flex-col gap-4 py-4">
        <div className="flex items-center justify-between"><span className="text-sm text-violet-300 font-semibold">Vote pour un joueur</span><span className={`text-2xl font-black tabular-nums ${remaining !== null && remaining <= 5 ? 'text-red-400' : 'text-white'}`}>{remaining ?? '—'}</span></div>
        <div className="p-3 rounded-xl border border-gray-700 bg-gray-800/60"><p className="text-sm font-bold text-white">{prompt(game, round)}</p></div>
        <div className="grid grid-cols-2 gap-2">
          {players.map((p) => {
            const selected = myVote === p._id
            return (
              <button key={p._id} onClick={() => submitVote({ gameId: game._id, playerId, targetKey: p._id }).catch(() => {})}
                className={`flex items-center gap-2 px-3 py-3 rounded-xl border transition-colors ${selected ? 'border-violet-500 bg-violet-900/30' : 'border-gray-700 bg-gray-800/40 hover:border-gray-600'}`}>
                <Avatar p={p} size={28} />
                <span className="text-sm font-medium text-white truncate">{p.pseudo}</span>
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
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-gray-400 text-sm">Tu marques</p>
        <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="px-8 py-4 rounded-2xl border border-violet-700 bg-violet-900/20">
          <p className="text-4xl font-black text-white">{myPts}</p>
          <p className="text-xs text-gray-400">total</p>
        </motion.div>
        <p className="text-gray-500 text-sm">Regarde l&apos;écran principal 👀</p>
      </div>
    )
  }
  return null
}
