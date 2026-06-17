'use client'

import { use, useState, useEffect, useRef } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { PetitBacHost } from '../games/PetitBac'
import { JustePrixHost } from '../games/JustePrix'
import { BluffHost } from '../games/Bluff'
import { MostLikelyHost } from '../games/MostLikely'
import { FamilyFeudHost } from '../games/FamilyFeud'

function beep() {
  try {
    const ctx = new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g)
    g.connect(ctx.destination)
    o.type = 'square'
    o.frequency.value = 760
    g.gain.setValueAtTime(0.12, ctx.currentTime)
    o.start()
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25)
    o.stop(ctx.currentTime + 0.26)
  } catch {
    /* AudioContext indisponible : on ignore */
  }
}

const GAME_LABELS: Record<string, string> = {
  petitbac: '🔤 Petit Bac',
  fibbage: '🤥 Fibbage',
  quiplash: '✍️ Quiplash',
  familyfeud: '📊 Une Famille en Or',
  mostlikely: '🫵 Qui est le + susceptible',
  justeprix: '🎯 Juste Prix',
}

type PlayerLite = { _id: string; pseudo: string; avatar: string; color: string; photoUrl?: string | null }

function Avatar({ p, size = 28 }: { p?: PlayerLite | null; size?: number }) {
  return (
    <div className="rounded-full flex items-center justify-center overflow-hidden shrink-0"
      style={{ width: size, height: size, backgroundColor: p?.color ?? '#6b7280', fontSize: size * 0.5 }}>
      {p?.photoUrl ? <img src={p.photoUrl} alt="" className="w-full h-full object-cover" /> : (p?.avatar ?? '?')}
    </div>
  )
}

export default function SessionHostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const sessionId = id as Id<'sessions'>
  const session = useQuery(api.sessions.get, { sessionId })

  const start = useMutation(api.sessions.start)
  const finishCurrentGame = useMutation(api.sessions.finishCurrentGame)
  const nextGame = useMutation(api.sessions.nextGame)
  const reset = useMutation(api.sessions.reset)
  const [confirmReset, setConfirmReset] = useState(false)

  // bip quand un compteur de sortie d'onglet augmente
  const totalAway = session ? session.players.reduce((s, p) => s + (p.awayCount ?? 0), 0) : 0
  const prevAwayRef = useRef(0)
  useEffect(() => {
    if (totalAway > prevAwayRef.current) beep()
    prevAwayRef.current = totalAway
  }, [totalAway])

  if (session === undefined) {
    return <main className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" /></main>
  }
  if (session === null) {
    return <main className="min-h-screen bg-gray-950 flex items-center justify-center flex-col gap-3"><p className="text-gray-400">Soirée introuvable.</p><Link href="/" className="text-violet-400 text-sm hover:underline">← Accueil</Link></main>
  }

  const players = session.players as PlayerLite[]
  const ranked = [...players].map((p) => ({ p, pts: session.scores[p._id] ?? 0 })).sort((a, b) => b.pts - a.pts)
  const gamePlayers = players
  const flaggedPlayers = session.players.filter((p) => (p.awayCount ?? 0) > 0)

  return (
    <main className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-gray-500 hover:text-white text-sm shrink-0">🏠</Link>
        <p className="flex-1 text-sm font-bold text-white truncate">{session.name}</p>
        <span className="text-xs text-gray-500 shrink-0">
          {session.phase === 'lobby' ? 'Lobby' : session.phase === 'finished' ? 'Terminé' : `Jeu ${session.currentGameIndex + 1}/${session.games.length}`}
        </span>
        {confirmReset ? (
          <span className="flex items-center gap-1 shrink-0">
            <button onClick={() => { reset({ sessionId }); setConfirmReset(false) }} className="px-2 py-1 rounded bg-orange-700 hover:bg-orange-600 text-white text-xs font-semibold">↻ Reprendre à 0</button>
            <button onClick={() => setConfirmReset(false)} className="px-2 py-1 rounded bg-gray-700 text-gray-300 text-xs">✕</button>
          </span>
        ) : (
          <button onClick={() => setConfirmReset(true)} title="Reprendre la soirée à zéro (garde les questions)" className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs shrink-0">↻</button>
        )}
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* ── Alerte anti-triche ── */}
        {flaggedPlayers.length > 0 && (
          <div className="mb-4 p-3 rounded-xl border border-red-700/60 bg-red-900/20 flex flex-col gap-1.5">
            <p className="text-xs font-bold text-red-300 uppercase tracking-wider">⚠️ Sorties d&apos;onglet détectées</p>
            <div className="flex flex-wrap gap-2">
              {flaggedPlayers
                .slice()
                .sort((a, b) => (b.lastAwayAt ?? 0) - (a.lastAwayAt ?? 0))
                .map((p) => {
                  const recent = Date.now() - (p.lastAwayAt ?? 0) < 6000
                  return (
                    <span key={p._id} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${recent ? 'bg-red-700/50 text-red-100 animate-pulse' : 'bg-gray-800 text-gray-300'}`}>
                      <Avatar p={p} size={16} />
                      {p.pseudo} <b>×{p.awayCount}</b>{recent ? ' • à l’instant' : ''}
                    </span>
                  )
                })}
            </div>
          </div>
        )}

        {/* ── LOBBY ── */}
        {session.phase === 'lobby' && (
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <p className="text-2xl font-black text-white">{session.name}</p>
              <p className="text-sm text-gray-500 mt-1">Les joueurs rejoignent sur leur téléphone</p>
              <p className="text-xs text-violet-400 mt-2 font-mono break-all">…/session/{id}/play</p>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Joueurs ({players.length})</p>
              {players.length === 0 ? <p className="text-gray-600 text-sm italic">Personne pour l&apos;instant…</p> : (
                <div className="flex flex-wrap gap-2">
                  {players.map((p) => (
                    <motion.div key={p._id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-700 bg-gray-800/50">
                      <Avatar p={p} size={26} />
                      <span className="text-sm text-white font-medium">{p.pseudo}</span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Programme ({session.games.length})</p>
              {session.games.length === 0 ? (
                <p className="text-gray-600 text-sm italic">Aucun jeu — ajoute-en dans l&apos;admin.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {session.games.map((g, i) => (
                    <div key={g._id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-800 bg-gray-800/30">
                      <span className="text-xs text-gray-500 w-5 text-center">{i + 1}</span>
                      <span className="text-sm text-white">{GAME_LABELS[g.type] ?? g.type}</span>
                      <span className="text-xs text-gray-500 ml-auto truncate">{g.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Link href={`/admin/session/${id}`} className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-semibold text-center text-sm transition-colors">⚙️ Éditer</Link>
              <button onClick={() => start({ sessionId })} disabled={session.games.length === 0}
                className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-bold transition-colors">
                ▶ Démarrer la soirée
              </button>
            </div>
          </div>
        )}

        {/* ── PLAYING ── */}
        {session.phase === 'playing' && session.currentGame && (
          <GameHostRouter game={session.currentGame} players={gamePlayers} onFinish={() => finishCurrentGame({ sessionId })} />
        )}

        {/* ── TRANSITION ── */}
        {session.phase === 'transition' && (
          <div className="flex flex-col gap-6 py-4">
            <p className="text-center text-lg font-bold text-white">
              {GAME_LABELS[session.currentGame?.type ?? ''] ?? 'Manche'} — terminé
            </p>
            <ScoreBoard ranked={ranked} rankPoints={session.currentGame?.state?.rankPoints} />
            <button onClick={() => nextGame({ sessionId })}
              className="mx-auto px-8 py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold transition-colors">
              {session.currentGameIndex + 1 >= session.games.length ? '🏁 Voir le classement final' : 'Manche suivante →'}
            </button>
          </div>
        )}

        {/* ── FINISHED ── */}
        {session.phase === 'finished' && (
          <div className="flex flex-col gap-6 py-4">
            <div className="text-center"><p className="text-4xl mb-2">🏆</p><p className="text-2xl font-black text-white">Classement final</p></div>
            <ScoreBoard ranked={ranked} podium />
            <div className="flex gap-3 justify-center flex-wrap">
              <button onClick={() => reset({ sessionId })} className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold transition-colors">🔁 Rejouer la soirée (garde les questions)</button>
              <Link href="/" className="px-6 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-semibold transition-colors">🏠 Accueil</Link>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function GameHostRouter({ game, players, onFinish }: { game: NonNullable<ReturnType<typeof useQuery<typeof api.sessions.get>>>['currentGame']; players: PlayerLite[]; onFinish: () => void }) {
  if (!game) return null
  switch (game.type) {
    case 'petitbac':
      return <PetitBacHost game={game as never} players={players} onFinish={onFinish} />
    case 'justeprix':
      return <JustePrixHost game={game as never} players={players} onFinish={onFinish} />
    case 'fibbage':
    case 'quiplash':
      return <BluffHost game={game as never} players={players} onFinish={onFinish} />
    case 'mostlikely':
      return <MostLikelyHost game={game as never} players={players} onFinish={onFinish} />
    case 'familyfeud':
      return <FamilyFeudHost game={game as never} players={players} onFinish={onFinish} />
    default:
      return (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-lg text-white font-bold">{GAME_LABELS[game.type] ?? game.type}</p>
          <p className="text-gray-500 text-sm">Ce jeu n&apos;est pas encore implémenté.</p>
          <button onClick={onFinish} className="px-5 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold transition-colors">Passer ce jeu →</button>
        </div>
      )
  }
}

function ScoreBoard({ ranked, rankPoints, podium }: { ranked: { p: PlayerLite; pts: number }[]; rankPoints?: Record<string, number>; podium?: boolean }) {
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div className="flex flex-col gap-2 max-w-md mx-auto w-full">
      {ranked.map(({ p, pts }, i) => (
        <motion.div key={p._id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${podium && i === 0 ? 'border-yellow-500/60 bg-yellow-900/15' : 'border-gray-700 bg-gray-800/40'}`}>
          <span className="w-7 text-center shrink-0 text-lg">{podium && i < 3 ? medals[i] : <span className="text-xs text-gray-500">#{i + 1}</span>}</span>
          <Avatar p={p} size={30} />
          <span className="flex-1 text-sm text-white font-medium truncate">{p.pseudo}</span>
          {rankPoints && <span className="text-xs text-green-400 font-semibold shrink-0">+{rankPoints[p._id] ?? 1}</span>}
          <span className="text-base font-black text-violet-300 shrink-0 w-12 text-right">{pts}</span>
        </motion.div>
      ))}
    </div>
  )
}
