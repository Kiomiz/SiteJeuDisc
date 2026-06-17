import { mutation } from './_generated/server'
import { v } from 'convex/values'

// Config : { prompts: [string] }
// state : { subPhase: intro|voting|reveal, roundIndex, deadline?, tally: {playerId: count}, rawScores }
// "Qui est le plus susceptible de…" : chacun vote pour un joueur. Ceux qui votent
// comme la majorité (le joueur le plus élu) marquent des points (ils ont "lu la salle").

export const startVoting = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId)
    if (!game) throw new Error('Jeu introuvable')
    await ctx.db.patch(args.gameId, {
      state: { ...game.state, subPhase: 'voting', deadline: Date.now() + 30 * 1000, tally: {} },
    })
  },
})

export const submitVote = mutation({
  args: { gameId: v.id('games'), playerId: v.id('players'), targetKey: v.string() },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId)
    if (!game) throw new Error('Jeu introuvable')
    if (game.state?.subPhase !== 'voting') throw new Error("Le vote n'est pas ouvert")
    const round = game.state?.roundIndex ?? 0

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

    const tally: Record<string, number> = {}
    for (const v0 of votes) {
      const k = v0.targetKey ?? ''
      if (k) tally[k] = (tally[k] ?? 0) + 1
    }
    const max = Math.max(0, ...Object.values(tally))
    const winners = new Set(Object.entries(tally).filter(([, c]) => c === max && max > 0).map(([k]) => k))

    const rawScores: Record<string, number> = { ...(game.state?.rawScores ?? {}) }
    for (const v0 of votes) {
      if (v0.targetKey && winners.has(v0.targetKey)) {
        rawScores[v0.voterId] = (rawScores[v0.voterId] ?? 0) + 100
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
    const total = (game.config?.prompts ?? []).length || 1
    if (round + 1 >= total) return
    await ctx.db.patch(args.gameId, {
      state: { ...game.state, subPhase: 'intro', roundIndex: round + 1, deadline: undefined, tally: {} },
    })
  },
})
