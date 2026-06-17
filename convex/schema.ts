import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  players: defineTable({
    pseudo: v.string(),
    avatar: v.string(),
    color: v.string(),
    photoStorageId: v.optional(v.id('_storage')),
  }).index('by_pseudo', ['pseudo']),

  weeks: defineTable({
    weekNumber: v.number(),
    title: v.string(),
    gameType: v.string(),
    createdBy: v.optional(v.id('players')),
    isActive: v.boolean(),
    playedAt: v.optional(v.number()),
    // Game state
    phase: v.optional(
      v.union(
        v.literal('waiting'),
        v.literal('question'),
        v.literal('correction'),
        v.literal('finished'),
      ),
    ),
    currentQuestionIndex: v.optional(v.number()),
    shuffledOrder: v.optional(v.array(v.number())),
    correctionFromIndex: v.optional(v.number()),
    hostPlayerId: v.optional(v.id('players')),
  }).index('by_weekNumber', ['weekNumber']),

  questions: defineTable({
    weekId: v.id('weeks'),
    number: v.number(),
    text: v.string(),
    answer: v.optional(v.string()),
    category: v.optional(v.string()),
  })
    .index('by_week', ['weekId'])
    .index('by_week_number', ['weekId', 'number']),

  answers: defineTable({
    playerId: v.id('players'),
    weekId: v.id('weeks'),
    questionNumber: v.number(),
    text: v.string(),
    points: v.optional(v.number()),
    confirmed: v.optional(v.boolean()),
  })
    .index('by_player', ['playerId'])
    .index('by_week', ['weekId'])
    .index('by_week_question', ['weekId', 'questionNumber']),

  scores: defineTable({
    playerId: v.id('players'),
    weekId: v.id('weeks'),
    points: v.number(),
  })
    .index('by_player', ['playerId'])
    .index('by_week', ['weekId']),

  // ─────────────────────────────────────────────────────────────────
  // Soirée mini-jeux
  // ─────────────────────────────────────────────────────────────────

  // Une "soirée" = enchaînement ordonné de mini-jeux avec score cumulé.
  sessions: defineTable({
    name: v.string(),
    createdAt: v.number(),
    phase: v.union(
      v.literal('lobby'), // joueurs rejoignent, host arrange les jeux
      v.literal('playing'), // un mini-jeu est en cours
      v.literal('transition'), // écran scores entre 2 jeux (bouton "Manche suivante")
      v.literal('finished'), // podium final
    ),
    currentGameIndex: v.number(),
    hostPlayerId: v.optional(v.id('players')),
  }),

  sessionPlayers: defineTable({
    sessionId: v.id('sessions'),
    playerId: v.id('players'),
    joinedAt: v.number(),
    awayCount: v.optional(v.number()), // nb de sorties d'onglet (anti-triche)
    lastAwayAt: v.optional(v.number()),
  })
    .index('by_session', ['sessionId'])
    .index('by_session_player', ['sessionId', 'playerId']),

  // Un doc par mini-jeu de la soirée.
  // config = contenu pré-rempli (format selon `type`)
  // state  = runtime ({ subPhase, roundIndex, deadline, rawScores: {playerId: pts}, ... })
  games: defineTable({
    sessionId: v.id('sessions'),
    order: v.number(),
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
    state: v.any(),
  })
    .index('by_session', ['sessionId'])
    .index('by_session_order', ['sessionId', 'order']),

  // Réponses libres des joueurs (petitbac, écriture fibbage/quiplash, familyfeud, justeprix).
  gameAnswers: defineTable({
    gameId: v.id('games'),
    sessionId: v.id('sessions'),
    playerId: v.id('players'),
    round: v.number(), // manche/question dans le jeu (0 si unique)
    slot: v.optional(v.string()), // ex: catégorie pour petitbac
    value: v.string(),
    // résultats de correction / scoring
    points: v.optional(v.number()),
    valid: v.optional(v.boolean()), // petitbac : validé par le host
    matchedKey: v.optional(v.string()), // familyfeud : réponse du sondage associée
  })
    .index('by_game', ['gameId'])
    .index('by_game_round', ['gameId', 'round'])
    .index('by_game_player', ['gameId', 'playerId']),

  // Votes (fibbage/quiplash : pour une réponse ; mostlikely : pour un joueur).
  votes: defineTable({
    gameId: v.id('games'),
    sessionId: v.id('sessions'),
    round: v.number(),
    voterId: v.id('players'),
    targetAnswerId: v.optional(v.id('gameAnswers')),
    targetPlayerId: v.optional(v.id('players')),
    targetKey: v.optional(v.string()), // clé d'option générique (answerId, 'truth', ou playerId)
  })
    .index('by_game_round', ['gameId', 'round'])
    .index('by_game_round_voter', ['gameId', 'round', 'voterId']),

  // Score cumulé de la soirée (points de rang).
  sessionScores: defineTable({
    sessionId: v.id('sessions'),
    playerId: v.id('players'),
    points: v.number(),
  })
    .index('by_session', ['sessionId'])
    .index('by_session_player', ['sessionId', 'playerId']),
})
