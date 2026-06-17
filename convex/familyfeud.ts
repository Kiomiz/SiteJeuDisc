import { mutation } from './_generated/server'
import { v } from 'convex/values'

// Config : { surveys: [{ question, answers: [{ text, count }] }], durationSec? }
// state : { subPhase: intro|writing|correction|results, roundIndex, deadline?, rawScores }
// "Une Famille en Or" : chacun propose UNE réponse, le host l'associe à une réponse
// du sondage (matching), points = popularité (count) de la réponse associée.

export const startWriting = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId)
    if (!game) throw new Error('Jeu introuvable')
    const durationSec = game.config?.durationSec ?? 30
    await ctx.db.patch(args.gameId, {
      state: { ...game.state, subPhase: 'writing', deadline: Date.now() + durationSec * 1000 },
    })
  },
})

export const submitGuess = mutation({
  args: { gameId: v.id('games'), playerId: v.id('players'), value: v.string() },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId)
    if (!game) throw new Error('Jeu introuvable')
    if (game.state?.subPhase !== 'writing') throw new Error('Les propositions sont fermées')
    const round = game.state?.roundIndex ?? 0

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

export const openCorrection = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId)
    if (!game) throw new Error('Jeu introuvable')
    await ctx.db.patch(args.gameId, { state: { ...game.state, subPhase: 'correction' } })
  },
})

/**
 * Le host associe une proposition à une réponse du sondage (ou '' pour refuser).
 * Les points sont automatiquement remplis avec la popularité de la réponse —
 * le host peut ensuite les ajuster à la main via games.setAnswerPoints.
 */
export const setMatch = mutation({
  args: { answerId: v.id('gameAnswers'), matchedKey: v.string() },
  handler: async (ctx, args) => {
    const answer = await ctx.db.get(args.answerId)
    if (!answer) throw new Error('Réponse introuvable')
    const game = await ctx.db.get(answer.gameId)
    const survey = (game?.config?.surveys ?? [])[answer.round]
    const countByText: Record<string, number> = {}
    for (const ans of survey?.answers ?? []) countByText[ans.text] = ans.count ?? 0
    const pts = args.matchedKey ? (countByText[args.matchedKey] ?? 0) : 0
    await ctx.db.patch(args.answerId, { matchedKey: args.matchedKey, points: pts })
  },
})

/** Valide la correction : additionne les points (popularité ou ajustés) et affiche les résultats. */
export const scoreRound = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId)
    if (!game) throw new Error('Jeu introuvable')
    const round = game.state?.roundIndex ?? 0

    const answers = await ctx.db
      .query('gameAnswers')
      .withIndex('by_game_round', (q) => q.eq('gameId', args.gameId).eq('round', round))
      .collect()

    const rawScores: Record<string, number> = { ...(game.state?.rawScores ?? {}) }
    for (const a of answers) {
      rawScores[a.playerId] = (rawScores[a.playerId] ?? 0) + (a.points ?? 0)
    }

    await ctx.db.patch(args.gameId, { state: { ...game.state, subPhase: 'results', rawScores } })
  },
})

export const nextRound = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId)
    if (!game) throw new Error('Jeu introuvable')
    const round = game.state?.roundIndex ?? 0
    const total = (game.config?.surveys ?? []).length || 1
    if (round + 1 >= total) return
    await ctx.db.patch(args.gameId, {
      state: { ...game.state, subPhase: 'intro', roundIndex: round + 1, deadline: undefined },
    })
  },
})
