import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { Doc } from './_generated/dataModel'
import { QueryCtx } from './_generated/server'

/** Fixe à la main les points d'une réponse (override host en correction). */
export const setAnswerPoints = mutation({
  args: { answerId: v.id('gameAnswers'), points: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.answerId, { points: args.points })
  },
})

async function enrichPlayers(ctx: QueryCtx, players: Doc<'players'>[]) {
  return await Promise.all(
    players.map(async (p) => ({
      ...p,
      photoUrl: p.photoStorageId ? await ctx.storage.getUrl(p.photoStorageId) : null,
    })),
  )
}

/** Le doc du jeu seul (config + state runtime). */
export const get = query({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.gameId)
  },
})

/** Toutes les réponses d'une manche, enrichies du joueur. */
export const roundAnswers = query({
  args: { gameId: v.id('games'), round: v.number() },
  handler: async (ctx, args) => {
    const answers = await ctx.db
      .query('gameAnswers')
      .withIndex('by_game_round', (q) => q.eq('gameId', args.gameId).eq('round', args.round))
      .collect()

    const playerIds = [...new Set(answers.map((a) => a.playerId))]
    const playerDocs = (await Promise.all(playerIds.map((id) => ctx.db.get(id)))).filter(
      (p): p is Doc<'players'> => p !== null,
    )
    const enriched = await enrichPlayers(ctx, playerDocs)
    const playerMap = Object.fromEntries(enriched.map((p) => [p._id, p]))

    return answers.map((a) => ({ ...a, player: playerMap[a.playerId] ?? null }))
  },
})

/** Tous les votes d'une manche (clé d'option ciblée par chaque votant). */
export const roundVotes = query({
  args: { gameId: v.id('games'), round: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('votes')
      .withIndex('by_game_round', (q) => q.eq('gameId', args.gameId).eq('round', args.round))
      .collect()
  },
})

/** Le vote d'un joueur pour une manche (sa clé d'option, ou null). */
export const myVote = query({
  args: { gameId: v.id('games'), round: v.number(), playerId: v.id('players') },
  handler: async (ctx, args) => {
    const vote = await ctx.db
      .query('votes')
      .withIndex('by_game_round_voter', (q) =>
        q.eq('gameId', args.gameId).eq('round', args.round).eq('voterId', args.playerId),
      )
      .first()
    return vote?.targetKey ?? null
  },
})

/** Les réponses d'un joueur pour une manche (pour pré-remplir son écran). */
export const myRoundAnswers = query({
  args: { gameId: v.id('games'), round: v.number(), playerId: v.id('players') },
  handler: async (ctx, args) => {
    const answers = await ctx.db
      .query('gameAnswers')
      .withIndex('by_game_round', (q) => q.eq('gameId', args.gameId).eq('round', args.round))
      .filter((q) => q.eq(q.field('playerId'), args.playerId))
      .collect()
    return answers
  },
})
