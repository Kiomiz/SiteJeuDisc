import { mutation } from './_generated/server'
import { v } from 'convex/values'
import { Doc } from './_generated/dataModel'

// Mécanique commune écrire → voter, pour deux jeux :
//  - fibbage : config { questions: [{ text, answer }], durationSec? }
//      écrire un MENSONGE plausible, puis retrouver la VRAIE réponse.
//  - quiplash : config { prompts: [string], durationSec? }
//      écrire une réponse drôle, puis voter la meilleure.
//
// state : { subPhase: intro|writing|voting|reveal, roundIndex, deadline?,
//           options: [{ key, text, authorId?, isTruth? }], tally: {key: count}, rawScores }

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Ouvre la phase d'écriture (chrono). */
export const startWriting = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId)
    if (!game) throw new Error('Jeu introuvable')
    const durationSec = game.config?.durationSec ?? 60
    await ctx.db.patch(args.gameId, {
      state: { ...game.state, subPhase: 'writing', deadline: Date.now() + durationSec * 1000, options: [], tally: {} },
    })
  },
})

/** Un joueur écrit / met à jour sa réponse (mensonge ou vanne). */
export const submitWriting = mutation({
  args: { gameId: v.id('games'), playerId: v.id('players'), value: v.string() },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId)
    if (!game) throw new Error('Jeu introuvable')
    if (game.state?.subPhase !== 'writing') throw new Error("L'écriture est fermée")
    const round = game.state?.roundIndex ?? 0

    // fibbage : interdiction de soumettre (par hasard) la vraie réponse
    if (game.type === 'fibbage') {
      const truth = game.config?.questions?.[round]?.answer ?? ''
      if (truth && norm(args.value) === norm(truth)) {
        throw new Error("Trop facile : c'est la vraie réponse 😏 trouve autre chose")
      }
    }

    const existing = await ctx.db
      .query('gameAnswers')
      .withIndex('by_game_round', (q) => q.eq('gameId', args.gameId).eq('round', round))
      .filter((q) => q.eq(q.field('playerId'), args.playerId))
      .first()
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value })
      return existing._id
    }
    return await ctx.db.insert('gameAnswers', {
      gameId: args.gameId,
      sessionId: game.sessionId,
      playerId: args.playerId,
      round,
      value: args.value,
    })
  },
})

/** Ferme l'écriture, construit les options (mélangées) et ouvre le vote. */
export const openVoting = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId)
    if (!game) throw new Error('Jeu introuvable')
    const round = game.state?.roundIndex ?? 0

    const answers = await ctx.db
      .query('gameAnswers')
      .withIndex('by_game_round', (q) => q.eq('gameId', args.gameId).eq('round', round))
      .collect()

    type Option = { key: string; text: string; authorId?: string; isTruth?: boolean }
    let options: Option[] = answers
      .filter((a) => a.value.trim() !== '')
      .map((a) => ({ key: a._id as string, text: a.value, authorId: a.playerId as string }))

    if (game.type === 'fibbage') {
      const truth = game.config?.questions?.[round]?.answer ?? ''
      // retire les mensonges identiques à la vérité
      options = options.filter((o) => norm(o.text) !== norm(truth))
      options.push({ key: 'truth', text: truth, isTruth: true })
    }

    await ctx.db.patch(args.gameId, {
      state: {
        ...game.state,
        subPhase: 'voting',
        options: shuffle(options),
        deadline: Date.now() + 45 * 1000,
        tally: {},
      },
    })
  },
})

/** Un joueur vote pour une option (interdit : sa propre réponse). */
export const submitVote = mutation({
  args: { gameId: v.id('games'), playerId: v.id('players'), targetKey: v.string() },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId)
    if (!game) throw new Error('Jeu introuvable')
    if (game.state?.subPhase !== 'voting') throw new Error("Le vote n'est pas ouvert")
    const round = game.state?.roundIndex ?? 0

    const options = (game.state?.options ?? []) as Array<{ key: string; authorId?: string }>
    const opt = options.find((o) => o.key === args.targetKey)
    if (!opt) throw new Error('Option invalide')
    if (opt.authorId && opt.authorId === args.playerId) throw new Error('Tu ne peux pas voter pour ta propre réponse')

    const existing = await ctx.db
      .query('votes')
      .withIndex('by_game_round_voter', (q) =>
        q.eq('gameId', args.gameId).eq('round', round).eq('voterId', args.playerId),
      )
      .first()
    if (existing) {
      await ctx.db.patch(existing._id, { targetKey: args.targetKey })
      return existing._id
    }
    return await ctx.db.insert('votes', {
      gameId: args.gameId,
      sessionId: game.sessionId,
      round,
      voterId: args.playerId,
      targetKey: args.targetKey,
    })
  },
})

/** Dépouille les votes, attribue les points, passe en révélation. */
export const reveal = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId)
    if (!game) throw new Error('Jeu introuvable')
    const round = game.state?.roundIndex ?? 0

    const votes = await ctx.db
      .query('votes')
      .withIndex('by_game_round', (q) => q.eq('gameId', args.gameId).eq('round', round))
      .collect()

    const options = (game.state?.options ?? []) as Array<{ key: string; authorId?: string; isTruth?: boolean }>
    const optByKey = Object.fromEntries(options.map((o) => [o.key, o]))

    const tally: Record<string, number> = {}
    const rawScores: Record<string, number> = { ...(game.state?.rawScores ?? {}) }

    for (const vote of votes) {
      const key = vote.targetKey ?? ''
      tally[key] = (tally[key] ?? 0) + 1
      const opt = optByKey[key]
      if (!opt) continue
      if (game.type === 'fibbage') {
        if (opt.isTruth) {
          rawScores[vote.voterId] = (rawScores[vote.voterId] ?? 0) + 100 // a trouvé la vérité
        } else if (opt.authorId) {
          rawScores[opt.authorId] = (rawScores[opt.authorId] ?? 0) + 75 // a piégé un joueur
        }
      } else {
        // quiplash : chaque vote rapporte à l'auteur
        if (opt.authorId) rawScores[opt.authorId] = (rawScores[opt.authorId] ?? 0) + 100
      }
    }

    await ctx.db.patch(args.gameId, { state: { ...game.state, subPhase: 'reveal', tally, rawScores } })
  },
})

export const nextRound = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId)
    if (!game) throw new Error('Jeu introuvable')
    const round = game.state?.roundIndex ?? 0
    const total = roundCount(game)
    if (round + 1 >= total) return
    await ctx.db.patch(args.gameId, {
      state: { ...game.state, subPhase: 'intro', roundIndex: round + 1, deadline: undefined, options: [], tally: {} },
    })
  },
})

function roundCount(game: Doc<'games'>): number {
  if (game.type === 'fibbage') return game.config?.questions?.length || 1
  return game.config?.prompts?.length || 1
}
