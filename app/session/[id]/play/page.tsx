'use client'

import { use, useEffect, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { PetitBacPlayer } from '../../games/PetitBac'
import { JustePrixPlayer } from '../../games/JustePrix'
import { BluffPlayer } from '../../games/Bluff'
import { MostLikelyPlayer } from '../../games/MostLikely'
import { FamilyFeudPlayer } from '../../games/FamilyFeud'
import type { PlayerLite } from '../../games/_shared'

const STORAGE_KEY = 'quiznight_player_id'

const GAME_LABELS: Record<string, string> = {
  petitbac: '🔤 Petit Bac',
  fibbage: '🤥 Fibbage',
  quiplash: '✍️ Quiplash',
  familyfeud: '📊 Une Famille en Or',
  mostlikely: '🫵 Qui est le + susceptible',
  justeprix: '🎯 Juste Prix',
}

export default function SessionPlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const sessionId = id as Id<'sessions'>

  const [playerId, setPlayerId] = useState<Id<'players'> | null>(null)
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) setPlayerId(saved as Id<'players'>)
  }, [])

  const session = useQuery(api.sessions.get, { sessionId })
  const player = useQuery(api.players.get, playerId ? { playerId } : 'skip')
  const join = useMutation(api.sessions.join)
  const flagAway = useMutation(api.sessions.flagAway)

  // auto-join une fois identifié
  useEffect(() => {
    if (!playerId || !session) return
    const already = session.players.some((p) => p._id === playerId)
    if (!already) join({ sessionId, playerId }).catch(() => {})
  }, [playerId, session?.players.length, sessionId, join])

  // anti-triche : signale quand le joueur quitte l'onglet pendant une manche
  const phase = session?.phase
  useEffect(() => {
    if (!playerId || phase !== 'playing') return
    function onHide() {
      if (document.visibilityState === 'hidden') {
        flagAway({ sessionId, playerId: playerId! }).catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [playerId, phase, sessionId, flagAway])

  if (session === undefined) {
    return <main className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" /></main>
  }
  if (session === null) {
    return <main className="min-h-screen bg-gray-950 flex items-center justify-center flex-col gap-3"><p className="text-gray-400">Soirée introuvable.</p><Link href="/" className="text-violet-400 text-sm hover:underline">← Accueil</Link></main>
  }
  if (!playerId) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center flex-col gap-4 px-6 text-center">
        <p className="text-xl text-white font-bold">Qui es-tu ?</p>
        <p className="text-gray-400 text-sm">Choisis ton profil depuis l&apos;accueil pour rejoindre.</p>
        <Link href="/" className="px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-colors">← Choisir mon profil</Link>
      </main>
    )
  }

  const myScore = session.scores[playerId] ?? 0
  const ranked = [...session.players].map((p) => ({ p, pts: session.scores[p._id] ?? 0 })).sort((a, b) => b.pts - a.pts)
  const myRank = ranked.findIndex((r) => r.p._id === playerId) + 1
  const gamePlayers = session.players as PlayerLite[]

  return (
    <main className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs text-gray-500 truncate">{session.name}</p>
          <p className="text-sm font-bold text-white">{player?.pseudo ?? '…'}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right"><p className="text-lg font-black text-white">{myScore}</p><p className="text-xs text-gray-500">pts</p></div>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg overflow-hidden shrink-0" style={{ backgroundColor: player?.color ?? '#6b7280' }}>
            {player?.photoUrl ? <img src={player.photoUrl} alt="" className="w-full h-full object-cover" /> : (player?.avatar ?? '?')}
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* LOBBY */}
        {session.phase === 'lobby' && (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="w-12 h-12 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            <p className="text-xl font-bold text-white">Tu es dans la place ✅</p>
            <p className="text-gray-500 text-sm">En attente du lancement de la soirée…</p>
            <p className="text-xs text-gray-600">{session.players.length} joueur(s) connecté(s)</p>
          </div>
        )}

        {/* PLAYING */}
        {session.phase === 'playing' && session.currentGame && (
          <GamePlayerRouter game={session.currentGame} playerId={playerId} players={gamePlayers} />
        )}

        {/* TRANSITION */}
        {session.phase === 'transition' && (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-gray-400 text-sm">{GAME_LABELS[session.currentGame?.type ?? ''] ?? 'Manche'} terminé</p>
            <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="px-8 py-5 rounded-2xl border border-violet-700 bg-violet-900/20">
              <p className="text-xs text-gray-400">Tu es</p>
              <p className="text-4xl font-black text-white">{myRank}<span className="text-lg text-gray-400">e</span></p>
              <p className="text-sm text-violet-300 font-bold mt-1">{myScore} pts</p>
            </motion.div>
            <p className="text-gray-500 text-sm">Regarde l&apos;écran principal…</p>
          </div>
        )}

        {/* FINISHED */}
        {session.phase === 'finished' && (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-4xl">{myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : '🎉'}</p>
            <p className="text-xl font-black text-white">{myRank === 1 ? 'Champion de la soirée !' : `${myRank}e place`}</p>
            <p className="text-violet-300 font-bold">{myScore} pts</p>
            <Link href="/" className="px-5 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold transition-colors mt-2">🏠 Accueil</Link>
          </div>
        )}
      </div>
    </main>
  )
}

function GamePlayerRouter({ game, playerId, players }: { game: NonNullable<ReturnType<typeof useQuery<typeof api.sessions.get>>>['currentGame']; playerId: Id<'players'>; players: PlayerLite[] }) {
  if (!game) return null
  switch (game.type) {
    case 'petitbac':
      return <PetitBacPlayer game={game as never} playerId={playerId} />
    case 'justeprix':
      return <JustePrixPlayer game={game as never} playerId={playerId} />
    case 'fibbage':
    case 'quiplash':
      return <BluffPlayer game={game as never} playerId={playerId} />
    case 'mostlikely':
      return <MostLikelyPlayer game={game as never} playerId={playerId} players={players} />
    case 'familyfeud':
      return <FamilyFeudPlayer game={game as never} playerId={playerId} />
    default:
      return (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          <p className="text-white font-bold">{GAME_LABELS[game.type] ?? game.type}</p>
          <p className="text-gray-500 text-sm">En attente…</p>
        </div>
      )
  }
}
