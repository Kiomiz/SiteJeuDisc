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
})
