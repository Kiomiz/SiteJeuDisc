import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { Doc } from './_generated/dataModel'
import { QueryCtx } from './_generated/server'

// ─────────────────────────────────────────────────────────────────
// Scoring par rang (normalisé) : chaque jeu rapporte selon le classement,
// donc tous les jeux pèsent pareil quel que soit leur barème brut.
// ─────────────────────────────────────────────────────────────────

const RANK_POINTS = [12, 9, 7, 5, 4, 3, 2] // 1er, 2e, 3e, ... ; au-delà → 1

function pointsForRank(rank: number): number {
  // rank est 0-indexé
  return RANK_POINTS[rank] ?? 1
}

/**
 * À partir des scores bruts d'un jeu (raw par joueur), renvoie les points
 * de rang à attribuer. Les ex-aequo reçoivent les mêmes points (ceux du
 * meilleur rang du groupe), le groupe suivant saute d'autant de positions.
 */
function rankPointsFromRaw(raw: Record<string, number>): Record<string, number> {
  const entries = Object.entries(raw)
  entries.sort((a, b) => b[1] - a[1])

  const result: Record<string, number> = {}
  let position = 0
  let i = 0
  while (i < entries.length) {
    // groupe d'ex-aequo
    let j = i
    while (j + 1 < entries.length && entries[j + 1][1] === entries[i][1]) j++
    const pts = pointsForRank(position)
    for (let k = i; k <= j; k++) result[entries[k][0]] = pts
    const groupSize = j - i + 1
    position += groupSize
    i = j + 1
  }
  return result
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

async function enrichPlayers(ctx: QueryCtx, players: Doc<'players'>[]) {
  return await Promise.all(
    players.map(async (p) => ({
      ...p,
      photoUrl: p.photoStorageId ? await ctx.storage.getUrl(p.photoStorageId) : null,
    })),
  )
}

function initGameState() {
  // État runtime de départ. Chaque jeu gère ensuite ses propres sous-phases.
  return { subPhase: 'intro' as const, roundIndex: 0, rawScores: {} as Record<string, number> }
}

// ─────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('sessions').order('desc').collect()
  },
})

export const get = query({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session) return null

    const games = await ctx.db
      .query('games')
      .withIndex('by_session_order', (q) => q.eq('sessionId', args.sessionId))
      .collect()
    games.sort((a, b) => a.order - b.order)

    const memberships = await ctx.db
      .query('sessionPlayers')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .collect()
    const playerDocs = (
      await Promise.all(memberships.map((m) => ctx.db.get(m.playerId)))
    ).filter((p): p is Doc<'players'> => p !== null)
    const players = (await enrichPlayers(ctx, playerDocs)).map((p) => {
      const m = memberships.find((mm) => mm.playerId === p._id)
      return { ...p, awayCount: m?.awayCount ?? 0, lastAwayAt: m?.lastAwayAt ?? 0 }
    })

    const scoreRows = await ctx.db
      .query('sessionScores')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .collect()
    const scores = Object.fromEntries(scoreRows.map((s) => [s.playerId, s.points]))

    return {
      ...session,
      games,
      players,
      scores,
      currentGame: games[session.currentGameIndex] ?? null,
    }
  },
})

// ─────────────────────────────────────────────────────────────────
// Lobby / setup
// ─────────────────────────────────────────────────────────────────

export const create = mutation({
  args: { name: v.string(), hostPlayerId: v.optional(v.id('players')) },
  handler: async (ctx, args) => {
    const sessionId = await ctx.db.insert('sessions', {
      name: args.name,
      createdAt: Date.now(),
      phase: 'lobby',
      currentGameIndex: 0,
      hostPlayerId: args.hostPlayerId,
    })
    if (args.hostPlayerId) {
      await ctx.db.insert('sessionPlayers', {
        sessionId,
        playerId: args.hostPlayerId,
        joinedAt: Date.now(),
      })
    }
    return sessionId
  },
})

export const join = mutation({
  args: { sessionId: v.id('sessions'), playerId: v.id('players') },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('sessionPlayers')
      .withIndex('by_session_player', (q) =>
        q.eq('sessionId', args.sessionId).eq('playerId', args.playerId),
      )
      .first()
    if (existing) return existing._id
    return await ctx.db.insert('sessionPlayers', {
      sessionId: args.sessionId,
      playerId: args.playerId,
      joinedAt: Date.now(),
    })
  },
})

/** Anti-triche : signale qu'un joueur a quitté l'onglet pendant une manche. */
export const flagAway = mutation({
  args: { sessionId: v.id('sessions'), playerId: v.id('players') },
  handler: async (ctx, args) => {
    const m = await ctx.db
      .query('sessionPlayers')
      .withIndex('by_session_player', (q) =>
        q.eq('sessionId', args.sessionId).eq('playerId', args.playerId),
      )
      .first()
    if (!m) return
    await ctx.db.patch(m._id, { awayCount: (m.awayCount ?? 0) + 1, lastAwayAt: Date.now() })
  },
})

export const addGame = mutation({
  args: {
    sessionId: v.id('sessions'),
    type: v.union(
      v.literal('petitbac'),
      v.literal('fibbage'),
      v.literal('quiplash'),
      v.literal('familyfeud'),
      v.literal('mostlikely'),
      v.literal('justeprix'),
    ),
    title: v.string(),
    config: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('games')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .collect()
    const order = existing.length
    return await ctx.db.insert('games', {
      sessionId: args.sessionId,
      order,
      type: args.type,
      title: args.title,
      config: args.config,
      state: initGameState(),
    })
  },
})

export const updateGame = mutation({
  args: {
    gameId: v.id('games'),
    title: v.optional(v.string()),
    config: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const patch: Partial<Doc<'games'>> = {}
    if (args.title !== undefined) patch.title = args.title
    if (args.config !== undefined) patch.config = args.config
    await ctx.db.patch(args.gameId, patch)
  },
})

export const removeGame = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId)
    if (!game) return
    await ctx.db.delete(args.gameId)
    // recompacte les ordres
    const rest = await ctx.db
      .query('games')
      .withIndex('by_session_order', (q) => q.eq('sessionId', game.sessionId))
      .collect()
    rest.sort((a, b) => a.order - b.order)
    await Promise.all(rest.map((g, i) => (g.order === i ? null : ctx.db.patch(g._id, { order: i }))))
  },
})

export const reorderGames = mutation({
  args: { orderedGameIds: v.array(v.id('games')) },
  handler: async (ctx, args) => {
    await Promise.all(
      args.orderedGameIds.map((id, i) => ctx.db.patch(id, { order: i })),
    )
  },
})

// ─────────────────────────────────────────────────────────────────
// Déroulé de la soirée
// ─────────────────────────────────────────────────────────────────

export const start = mutation({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    const games = await ctx.db
      .query('games')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .collect()
    if (games.length === 0) throw new Error('Aucun jeu dans cette soirée')
    await ctx.db.patch(args.sessionId, { phase: 'playing', currentGameIndex: 0 })
  },
})

/**
 * Clôt le jeu en cours : lit `state.rawScores`, le convertit en points de rang
 * pour TOUS les joueurs de la soirée, les ajoute au score cumulé, puis passe
 * en phase de transition.
 */
export const finishCurrentGame = mutation({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error('Soirée introuvable')

    const games = await ctx.db
      .query('games')
      .withIndex('by_session_order', (q) => q.eq('sessionId', args.sessionId))
      .collect()
    games.sort((a, b) => a.order - b.order)
    const game = games[session.currentGameIndex]
    if (!game) throw new Error('Aucun jeu en cours')

    // déjà clôturé ? (idempotent)
    if (session.phase === 'transition') return

    const memberships = await ctx.db
      .query('sessionPlayers')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .collect()

    // Tout le monde joue tous les jeux (le host administre via l'écran principal).
    const playing = memberships

    const raw: Record<string, number> = {}
    const stateRaw = (game.state?.rawScores ?? {}) as Record<string, number>
    for (const m of playing) raw[m.playerId] = stateRaw[m.playerId] ?? 0

    const rankPts = rankPointsFromRaw(raw)

    // accumule dans sessionScores
    for (const m of playing) {
      const add = rankPts[m.playerId] ?? 1
      const existing = await ctx.db
        .query('sessionScores')
        .withIndex('by_session_player', (q) =>
          q.eq('sessionId', args.sessionId).eq('playerId', m.playerId),
        )
        .first()
      if (existing) {
        await ctx.db.patch(existing._id, { points: existing.points + add })
      } else {
        await ctx.db.insert('sessionScores', {
          sessionId: args.sessionId,
          playerId: m.playerId,
          points: add,
        })
      }
    }

    // mémorise les points de rang attribués (pour l'écran de transition)
    await ctx.db.patch(game._id, {
      state: { ...game.state, subPhase: 'done', rankPoints: rankPts },
    })
    await ctx.db.patch(args.sessionId, { phase: 'transition' })
  },
})

export const nextGame = mutation({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error('Soirée introuvable')

    const games = await ctx.db
      .query('games')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .collect()

    const nextIndex = session.currentGameIndex + 1
    if (nextIndex >= games.length) {
      await ctx.db.patch(args.sessionId, { phase: 'finished' })
    } else {
      await ctx.db.patch(args.sessionId, { phase: 'playing', currentGameIndex: nextIndex })
    }
  },
})

export const finish = mutation({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { phase: 'finished' })
  },
})

/**
 * Remet la soirée à zéro SANS supprimer le contenu : on efface les réponses,
 * votes, scores cumulés et l'état runtime des jeux, mais on GARDE les jeux,
 * leur config (questions/catégories/objets…) et les joueurs déjà présents.
 */
export const reset = mutation({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    const games = await ctx.db
      .query('games')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .collect()

    for (const g of games) {
      const answers = await ctx.db
        .query('gameAnswers')
        .withIndex('by_game', (q) => q.eq('gameId', g._id))
        .collect()
      const votes = await ctx.db
        .query('votes')
        .withIndex('by_game_round', (q) => q.eq('gameId', g._id))
        .collect()
      await Promise.all([...answers.map((a) => ctx.db.delete(a._id)), ...votes.map((vv) => ctx.db.delete(vv._id))])
      // réinitialise l'état runtime (garde config + titre + ordre)
      await ctx.db.patch(g._id, { state: { subPhase: 'intro', roundIndex: 0, rawScores: {} } })
    }

    const scores = await ctx.db
      .query('sessionScores')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .collect()
    await Promise.all(scores.map((s) => ctx.db.delete(s._id)))

    // remet les compteurs anti-triche à zéro
    const members = await ctx.db
      .query('sessionPlayers')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .collect()
    await Promise.all(members.map((m) => ctx.db.patch(m._id, { awayCount: 0, lastAwayAt: undefined })))

    await ctx.db.patch(args.sessionId, { phase: 'lobby', currentGameIndex: 0 })
  },
})

/** Supprime une soirée et toutes ses données associées. */
export const remove = mutation({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    const games = await ctx.db
      .query('games')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .collect()
    const players = await ctx.db
      .query('sessionPlayers')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .collect()
    const scores = await ctx.db
      .query('sessionScores')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .collect()

    // gameAnswers + votes par jeu
    for (const g of games) {
      const answers = await ctx.db
        .query('gameAnswers')
        .withIndex('by_game', (q) => q.eq('gameId', g._id))
        .collect()
      const votes = await ctx.db
        .query('votes')
        .withIndex('by_game_round', (q) => q.eq('gameId', g._id))
        .collect()
      await Promise.all([...answers.map((a) => ctx.db.delete(a._id)), ...votes.map((vv) => ctx.db.delete(vv._id))])
    }

    await Promise.all([
      ...games.map((g) => ctx.db.delete(g._id)),
      ...players.map((p) => ctx.db.delete(p._id)),
      ...scores.map((s) => ctx.db.delete(s._id)),
    ])
    await ctx.db.delete(args.sessionId)
  },
})
