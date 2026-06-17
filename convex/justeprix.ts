import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

// Config : { items: [{ imageUrl?, imageStorageId?, label, price, trapNote? }], durationSec? }
// state : { subPhase, roundIndex (= index de l'objet), deadline?, rawScores }

/** Items avec URL d'image résolue (URL directe ou fichier uploadé). */
export const items = query({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId)
    if (!game) return []
    const raw = (game.config?.items ?? []) as Array<{
      imageUrl?: string
      imageStorageId?: string
      label?: string
      price?: number
      trapNote?: string
    }>
    return await Promise.all(
      raw.map(async (it) => ({
        label: it.label ?? '',
        price: it.price ?? 0,
        trapNote: it.trapNote ?? '',
        imageUrl: it.imageStorageId
          ? await ctx.storage.getUrl(it.imageStorageId as never)
          : (it.imageUrl ?? null),
      })),
    )
  },
})

/** Révèle l'objet courant et ouvre les estimations (chrono). */
export const startItem = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId)
    if (!game) throw new Error('Jeu introuvable')
    const durationSec = game.config?.durationSec ?? 30
    await ctx.db.patch(args.gameId, {
      state: { ...game.state, subPhase: 'guessing', deadline: Date.now() + durationSec * 1000 },
    })
  },
})

export const submitGuess = mutation({
  args: { gameId: v.id('games'), playerId: v.id('players'), value: v.string() },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId)
    if (!game) throw new Error('Jeu introuvable')
    if (game.state?.subPhase !== 'guessing') throw new Error('Les estimations sont fermées')
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

/**
 * Ferme les estimations : calcule des points AUTO selon la proximité, puis passe
 * en correction (le host peut ajuster avant de révéler).
 * points = round(100 * max(0, 1 - erreur_relative))  (+ bonus si très proche).
 */
export const endGuessing = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId)
    if (!game) throw new Error('Jeu introuvable')
    const round = game.state?.roundIndex ?? 0
    const item = (game.config?.items ?? [])[round]
    const price: number = item?.price ?? 0

    const answers = await ctx.db
      .query('gameAnswers')
      .withIndex('by_game_round', (q) => q.eq('gameId', args.gameId).eq('round', round))
      .collect()

    for (const a of answers) {
      const guess = parseFloat(a.value.replace(',', '.').replace(/[^0-9.]/g, ''))
      let pts = 0
      if (!Number.isNaN(guess) && price > 0) {
        const err = Math.abs(guess - price) / price
        pts = Math.round(100 * Math.max(0, 1 - Math.min(1, err)))
        if (err <= 0.1) pts += 20 // bonus "dans le mille"
      }
      await ctx.db.patch(a._id, { points: pts })
    }

    await ctx.db.patch(args.gameId, { state: { ...game.state, subPhase: 'correction' } })
  },
})

/** Révèle le vrai prix et additionne les points (auto ou ajustés par le host). */
export const revealItem = mutation({
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

    await ctx.db.patch(args.gameId, { state: { ...game.state, subPhase: 'reveal', rawScores } })
  },
})

export const nextItem = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId)
    if (!game) throw new Error('Jeu introuvable')
    const round = game.state?.roundIndex ?? 0
    const total = (game.config?.items ?? []).length || 1
    if (round + 1 >= total) return
    await ctx.db.patch(args.gameId, {
      state: { ...game.state, subPhase: 'intro', roundIndex: round + 1, deadline: undefined },
    })
  },
})
