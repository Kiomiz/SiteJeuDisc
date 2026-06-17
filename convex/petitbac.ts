import { mutation } from './_generated/server'
import { v } from 'convex/values'

// Config attendue : { rounds: [{ letter: string, categories: string[] }], durationSec: number }
// State : { subPhase, roundIndex, deadline?, rawScores: {playerId: total} }

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // accents
    .replace(/\s+/g, ' ')
}

// Lettres "jouables" en français (on écarte K, Q, U, W, X, Y, Z).
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'L', 'M', 'N', 'O', 'P', 'R', 'S', 'T', 'V']

/** Lance la manche courante : tire une lettre aléatoire et ouvre la saisie. */
export const startRound = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId)
    if (!game) throw new Error('Jeu introuvable')
    const durationSec = game.config?.durationSec ?? 90
    const letter = LETTERS[Math.floor(Math.random() * LETTERS.length)]
    await ctx.db.patch(args.gameId, {
      state: {
        ...game.state,
        subPhase: 'playing',
        letter,
        deadline: Date.now() + durationSec * 1000,
      },
    })
  },
})

/** Un joueur saisit / met à jour un mot pour une catégorie. */
export const submitWord = mutation({
  args: {
    gameId: v.id('games'),
    playerId: v.id('players'),
    slot: v.string(),
    value: v.string(),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId)
    if (!game) throw new Error('Jeu introuvable')
    if (game.state?.subPhase !== 'playing') throw new Error("La saisie n'est pas ouverte")
    const round = game.state?.roundIndex ?? 0

    const existing = await ctx.db
      .query('gameAnswers')
      .withIndex('by_game_round', (q) => q.eq('gameId', args.gameId).eq('round', round))
      .filter((q) =>
        q.and(q.eq(q.field('playerId'), args.playerId), q.eq(q.field('slot'), args.slot)),
      )
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
      slot: args.slot,
      value: args.value,
    })
  },
})

/**
 * Ferme la saisie et pré-remplit des points SUGGÉRÉS, puis passe en correction.
 * unique (seul à avoir ce mot dans la catégorie) = 2 ; partagé = 1 ; vide = 0.
 * Le host peut ensuite ajuster chaque réponse à la main (games.setAnswerPoints).
 */
export const endRound = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId)
    if (!game) throw new Error('Jeu introuvable')
    const round = game.state?.roundIndex ?? 0

    const answers = await ctx.db
      .query('gameAnswers')
      .withIndex('by_game_round', (q) => q.eq('gameId', args.gameId).eq('round', round))
      .collect()

    const counts: Record<string, Record<string, number>> = {}
    for (const a of answers) {
      if (normalize(a.value) === '') continue
      const slot = a.slot ?? ''
      const norm = normalize(a.value)
      counts[slot] ??= {}
      counts[slot][norm] = (counts[slot][norm] ?? 0) + 1
    }

    for (const a of answers) {
      let pts = 0
      if (normalize(a.value) !== '') {
        const slot = a.slot ?? ''
        const norm = normalize(a.value)
        pts = (counts[slot]?.[norm] ?? 1) === 1 ? 2 : 1
      }
      await ctx.db.patch(a._id, { points: pts })
    }

    await ctx.db.patch(args.gameId, { state: { ...game.state, subPhase: 'correction' } })
  },
})

/** Valide la correction : additionne les points (éventuellement ajustés) et affiche les résultats. */
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

/** Relance une nouvelle manche (manches illimitées : le host décide). */
export const newRound = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId)
    if (!game) throw new Error('Jeu introuvable')
    const round = game.state?.roundIndex ?? 0
    await ctx.db.patch(args.gameId, {
      state: { ...game.state, subPhase: 'intro', roundIndex: round + 1, letter: undefined, deadline: undefined },
    })
  },
})
