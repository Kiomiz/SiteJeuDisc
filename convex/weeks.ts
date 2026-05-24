import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('weeks').withIndex('by_weekNumber').collect()
  },
})

export const getActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('weeks')
      .filter((q) => q.eq(q.field('isActive'), true))
      .first()
  },
})

export const create = mutation({
  args: {
    weekNumber: v.number(),
    title: v.string(),
    gameType: v.string(),
    createdBy: v.optional(v.id('players')),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('weeks', {
      ...args,
      isActive: false,
    })
  },
})

export const get = query({
  args: { weekId: v.id('weeks') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.weekId)
  },
})

export const setActive = mutation({
  args: { weekId: v.id('weeks') },
  handler: async (ctx, args) => {
    const all = await ctx.db.query('weeks').collect()
    for (const w of all) {
      if (w.isActive) await ctx.db.patch(w._id, { isActive: false })
    }
    await ctx.db.patch(args.weekId, { isActive: true })
  },
})

export const startGame = mutation({
  args: { weekId: v.id('weeks') },
  handler: async (ctx, args) => {
    const questions = await ctx.db
      .query('questions')
      .withIndex('by_week', (q) => q.eq('weekId', args.weekId))
      .collect()

    if (questions.length === 0) throw new Error('Aucune question pour cette semaine')

    const numbers = questions.map((q) => q.number)
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[numbers[i], numbers[j]] = [numbers[j], numbers[i]]
    }

    await ctx.db.patch(args.weekId, {
      phase: 'question',
      currentQuestionIndex: 0,
      shuffledOrder: numbers,
      correctionFromIndex: 0,
      isActive: true,
    })
  },
})

export const nextQuestion = mutation({
  args: { weekId: v.id('weeks') },
  handler: async (ctx, args) => {
    const week = await ctx.db.get(args.weekId)
    if (!week) throw new Error('Semaine introuvable')

    const currentIndex = week.currentQuestionIndex ?? 0
    const total = week.shuffledOrder?.length ?? 0
    const nextIndex = currentIndex + 1

    if (nextIndex >= total) {
      await ctx.db.patch(args.weekId, { phase: 'finished', playedAt: Date.now(), isActive: false })
    } else {
      await ctx.db.patch(args.weekId, { currentQuestionIndex: nextIndex })
    }
  },
})

export const startCorrection = mutation({
  args: { weekId: v.id('weeks') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.weekId, { phase: 'correction' })
  },
})

export const resumeGame = mutation({
  args: { weekId: v.id('weeks') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.weekId, { phase: 'question' })
  },
})

export const finishCorrection = mutation({
  args: { weekId: v.id('weeks') },
  handler: async (ctx, args) => {
    const week = await ctx.db.get(args.weekId)
    if (!week) throw new Error('Semaine introuvable')
    await ctx.db.patch(args.weekId, {
      phase: 'question',
      correctionFromIndex: (week.currentQuestionIndex ?? 0) + 1,
    })
  },
})

export const finishGame = mutation({
  args: { weekId: v.id('weeks') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.weekId, {
      phase: 'finished',
      playedAt: Date.now(),
      isActive: false,
    })
  },
})

export const setHost = mutation({
  args: { weekId: v.id('weeks'), playerId: v.id('players') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.weekId, { hostPlayerId: args.playerId })
  },
})

export const deleteWeek = mutation({
  args: { weekId: v.id('weeks') },
  handler: async (ctx, args) => {
    const [answers, questions, scores] = await Promise.all([
      ctx.db.query('answers').withIndex('by_week', (q) => q.eq('weekId', args.weekId)).collect(),
      ctx.db.query('questions').withIndex('by_week', (q) => q.eq('weekId', args.weekId)).collect(),
      ctx.db.query('scores').withIndex('by_week', (q) => q.eq('weekId', args.weekId)).collect(),
    ])

    await Promise.all([
      ...answers.map((a) => ctx.db.delete(a._id)),
      ...questions.map((q) => ctx.db.delete(q._id)),
      ...scores.map((s) => ctx.db.delete(s._id)),
    ])

    await ctx.db.delete(args.weekId)
  },
})
