'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { motion } from 'framer-motion'
import { Avatar, useCountdown, eur, PointsPicker, PlayerLite } from './_shared'

type Game = {
  _id: Id<'games'>
  config: { items?: unknown[]; durationSec?: number }
  state: { subPhase?: string; roundIndex?: number; deadline?: number; rawScores?: Record<string, number> }
}

function useItems(gameId: Id<'games'>) {
  return useQuery(api.justeprix.items, { gameId })
}

// ═══════════════ HOST ═══════════════

export function JustePrixHost({ game, players, onFinish }: { game: Game; players: PlayerLite[]; onFinish: () => void }) {
  const sub = game.state?.subPhase ?? 'intro'
  const round = game.state?.roundIndex ?? 0
  const items = useItems(game._id)
  const total = items?.length ?? 0
  const item = items?.[round]
  const answers = useQuery(api.games.roundAnswers, { gameId: game._id, round })
  const remaining = useCountdown(game.state?.deadline)

  const startItem = useMutation(api.justeprix.startItem)
  const endGuessing = useMutation(api.justeprix.endGuessing)
  const revealItem = useMutation(api.justeprix.revealItem)
  const setAnswerPoints = useMutation(api.games.setAnswerPoints)
  const nextItem = useMutation(api.justeprix.nextItem)

  const endedRef = useRef(false)
  useEffect(() => {
    if (sub !== 'guessing') { endedRef.current = false; return }
    if (remaining === 0 && !endedRef.current) {
      endedRef.current = true
      endGuessing({ gameId: game._id })
    }
  }, [sub, remaining, game._id, endGuessing])

  if (items === undefined) return <div className="h-40 rounded-xl bg-gray-800 animate-pulse" />
  if (total === 0) return <p className="text-gray-400 text-center py-8">Juste Prix : aucun objet configuré.</p>

  if (sub === 'intro') {
    return (
      <div className="flex flex-col items-center gap-6 py-10 text-center">
        <p className="text-sm text-gray-400">Objet {round + 1} / {total}</p>
        <p className="text-3xl">🎯</p>
        <p className="text-lg font-bold text-white">Juste Prix</p>
        <p className="text-gray-500 text-sm max-w-sm">Devinez le prix de l&apos;objet. Le plus proche gagne le plus de points (attention aux pièges !).</p>
        <button onClick={() => startItem({ gameId: game._id })} className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold transition-colors">
          ▶ Révéler l&apos;objet
        </button>
      </div>
    )
  }

  if (sub === 'guessing') {
    const guessMap = Object.fromEntries((answers ?? []).map((a) => [a.playerId, a.value]))
    return (
      <div className="flex flex-col items-center gap-5 py-4">
        <div className="flex items-center justify-between w-full max-w-md">
          <span className="text-sm text-gray-400">Objet {round + 1} / {total}</span>
          <span className={`text-4xl font-black tabular-nums ${remaining !== null && remaining <= 5 ? 'text-red-400' : 'text-white'}`}>{remaining ?? '—'}</span>
        </div>
        <ItemImage url={item?.imageUrl} label={item?.label} />
        <p className="text-xl font-bold text-white text-center">{item?.label}</p>
        <p className="text-sm text-gray-400">Estimations en direct 💸</p>
        <div className="flex flex-col gap-1.5 w-full max-w-sm">
          {players.map((p) => {
            const g = guessMap[p._id]?.trim()
            return (
              <div key={p._id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 bg-gray-800/40">
                <Avatar p={p} size={22} />
                <span className="flex-1 text-sm text-gray-300 truncate">{p.pseudo}</span>
                <span className={`text-sm font-bold ${g ? 'text-white' : 'text-gray-600'}`}>{g ? `${g} €` : '…'}</span>
              </div>
            )
          })}
        </div>
        <button onClick={() => endGuessing({ gameId: game._id })} className="px-5 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold transition-colors">⏹ Terminer les estimations</button>
      </div>
    )
  }

  if (sub === 'correction') {
    const playerMap = Object.fromEntries(players.map((p) => [p._id, p]))
    const price = item?.price ?? 0
    const guesses = (answers ?? [])
      .map((a) => ({ a, guess: parseFloat(a.value.replace(',', '.').replace(/[^0-9.]/g, '')), player: playerMap[a.playerId] }))
      .filter((g) => !Number.isNaN(g.guess))
      .sort((x, y) => Math.abs(x.guess - price) - Math.abs(y.guess - price))
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <p className="text-lg font-bold text-white">📝 Correction — {item?.label}</p>
        <div className="px-5 py-2 rounded-xl bg-green-900/20 border border-green-700 text-center">
          <span className="text-xs text-gray-400">Vrai prix (visible host) : </span>
          <span className="text-lg font-black text-green-300">{eur(price)}</span>
        </div>
        {item?.trapNote && <p className="text-xs text-yellow-400 text-center">⚠️ {item.trapNote}</p>}
        <p className="text-xs text-gray-500 text-center max-w-md">Points auto selon la proximité. Ajuste à la main si besoin, puis révèle aux joueurs.</p>
        <div className="flex flex-col gap-2 max-w-md w-full">
          {guesses.map(({ a, guess, player }) => (
            <div key={a._id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-700 bg-gray-800/40">
              <Avatar p={player} size={24} />
              <span className="flex-1 text-sm text-white truncate">{player?.pseudo}</span>
              <span className="text-sm text-gray-300 shrink-0">{eur(guess)}</span>
              <PointsPicker value={a.points ?? 0} onSet={(n) => setAnswerPoints({ answerId: a._id, points: n })} options={[0]} />
            </div>
          ))}
          {guesses.length === 0 && <p className="text-gray-600 text-sm italic text-center">Aucune estimation.</p>}
        </div>
        <button onClick={() => revealItem({ gameId: game._id })} className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold transition-colors">Révéler aux joueurs →</button>
      </div>
    )
  }

  if (sub === 'reveal') {
    const playerMap = Object.fromEntries(players.map((p) => [p._id, p]))
    const guesses = (answers ?? [])
      .map((a) => ({ a, guess: parseFloat(a.value.replace(',', '.').replace(/[^0-9.]/g, '')), player: playerMap[a.playerId] }))
      .filter((g) => !Number.isNaN(g.guess))
      .sort((x, y) => Math.abs(x.guess - (item?.price ?? 0)) - Math.abs(y.guess - (item?.price ?? 0)))
    const isLast = round + 1 >= total
    return (
      <div className="flex flex-col items-center gap-5 py-4">
        <ItemImage url={item?.imageUrl} label={item?.label} />
        <p className="text-lg font-bold text-white">{item?.label}</p>
        <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="px-8 py-4 rounded-2xl bg-green-900/20 border border-green-700">
          <p className="text-xs text-gray-400 text-center">Vrai prix</p>
          <p className="text-4xl font-black text-green-300">{eur(item?.price ?? 0)}</p>
        </motion.div>
        {item?.trapNote && <p className="text-sm text-yellow-400 text-center max-w-sm">⚠️ {item.trapNote}</p>}
        <div className="flex flex-col gap-2 max-w-md w-full">
          {guesses.map(({ a, guess, player }, i) => (
            <div key={a._id} className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${i === 0 ? 'border-yellow-500/60 bg-yellow-900/15' : 'border-gray-700 bg-gray-800/40'}`}>
              <span className="w-5 text-center shrink-0">{i === 0 ? '🎯' : <span className="text-xs text-gray-500">#{i + 1}</span>}</span>
              <Avatar p={player} size={26} />
              <span className="flex-1 text-sm text-white truncate">{player?.pseudo}</span>
              <span className="text-sm text-gray-300 shrink-0">{eur(guess)}</span>
              <span className="text-sm font-black text-violet-300 shrink-0 w-10 text-right">+{a.points ?? 0}</span>
            </div>
          ))}
        </div>
        {isLast ? (
          <button onClick={onFinish} className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold transition-colors">✓ Terminer le Juste Prix</button>
        ) : (
          <button onClick={() => nextItem({ gameId: game._id })} className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold transition-colors">Objet suivant →</button>
        )}
      </div>
    )
  }
  return null
}

function ItemImage({ url, label }: { url?: string | null; label?: string }) {
  if (!url) {
    return <div className="w-full max-w-sm aspect-video rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-600 text-sm">{label ?? 'objet'}</div>
  }
  return <img src={url} alt={label ?? ''} className="w-full max-w-sm rounded-2xl border border-gray-700 object-contain max-h-72" />
}

// ═══════════════ JOUEUR ═══════════════

export function JustePrixPlayer({ game, playerId }: { game: Game; playerId: Id<'players'> }) {
  const sub = game.state?.subPhase ?? 'intro'
  const round = game.state?.roundIndex ?? 0
  const items = useItems(game._id)
  const item = items?.[round]
  const remaining = useCountdown(game.state?.deadline)

  const myAnswers = useQuery(api.games.myRoundAnswers, { gameId: game._id, round, playerId })
  const allGuesses = useQuery(
    api.games.roundAnswers,
    sub === 'guessing' ? { gameId: game._id, round } : 'skip',
  )
  const submitGuess = useMutation(api.justeprix.submitGuess)

  const [value, setValue] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => { setValue('') }, [round])
  useEffect(() => {
    const v = myAnswers?.[0]?.value
    if (v !== undefined) setValue((prev) => (prev === '' ? v : prev))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, myAnswers?.length])

  function onChange(val: string) {
    setValue(val)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { submitGuess({ gameId: game._id, playerId, value: val }).catch(() => {}) }, 500)
  }

  if (sub === 'intro') {
    return <div className="flex flex-col items-center gap-3 py-12 text-center"><p className="text-3xl">🎯</p><p className="text-white font-bold">Juste Prix</p><p className="text-gray-500 text-sm">Prépare ton portefeuille…</p></div>
  }

  if (sub === 'guessing') {
    return (
      <div className="flex flex-col gap-4 py-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Objet {round + 1}</span>
          <span className={`text-3xl font-black tabular-nums ${remaining !== null && remaining <= 5 ? 'text-red-400' : 'text-white'}`}>{remaining ?? '—'}</span>
        </div>
        <ItemImage url={item?.imageUrl} label={item?.label} />
        <p className="text-center font-bold text-white">{item?.label}</p>
        <div className="relative">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            inputMode="decimal"
            placeholder="Ton estimation"
            className="w-full px-4 py-4 pr-10 rounded-xl bg-gray-800 border border-gray-700 text-white text-xl font-bold text-center focus:outline-none focus:border-violet-500 transition-colors"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">€</span>
        </div>
        <p className="text-center text-xs text-gray-600">Enregistré automatiquement.</p>

        {allGuesses && allGuesses.filter((a) => a.value.trim()).length > 0 && (
          <div className="flex flex-col gap-1.5 mt-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Estimations en direct</p>
            {allGuesses.filter((a) => a.value.trim()).map((a) => (
              <div key={a._id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 bg-gray-800/40">
                <Avatar p={a.player} size={20} />
                <span className="flex-1 text-sm text-gray-300 truncate">{a.player?.pseudo ?? '?'}{a.playerId === playerId ? ' (toi)' : ''}</span>
                <span className="text-sm font-bold text-white">{a.value} €</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (sub === 'correction') {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <motion.p className="text-3xl" animate={{ rotate: [0, -10, 10, 0] }} transition={{ duration: 0.5 }}>📝</motion.p>
        <p className="text-white font-bold">Le host vérifie les estimations…</p>
        {value.trim() && <p className="text-gray-400 text-sm">Ton estimation : <b className="text-white">{value} €</b></p>}
      </div>
    )
  }

  if (sub === 'reveal') {
    const myPts = game.state?.rawScores?.[playerId] ?? 0
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-gray-400 text-sm">Vrai prix</p>
        <p className="text-3xl font-black text-green-300">{eur(item?.price ?? 0)}</p>
        <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="px-8 py-4 rounded-2xl border border-violet-700 bg-violet-900/20 mt-2">
          <p className="text-4xl font-black text-white">{myPts}</p>
          <p className="text-xs text-gray-400">total Juste Prix</p>
        </motion.div>
      </div>
    )
  }
  return null
}
