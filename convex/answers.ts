import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

export const submit = mutation({
  args: {
    playerId: v.id('players'),
    weekId: v.id('weeks'),
    questionNumber: v.number(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const week = await ctx.db.get(args.weekId)
    if (!week || week.phase !== 'question') {
      throw new Error("La partie n'est pas en phase de questions")
    }

    const currentQuestionNumber = week.shuffledOrder?.[week.currentQuestionIndex ?? 0]
    if (currentQuestionNumber !== args.questionNumber) {
      throw new Error("Cette question n'est plus active")
    }

    const existing = await ctx.db
      .query('answers')
      .withIndex('by_week_question', (q) =>
        q.eq('weekId', args.weekId).eq('questionNumber', args.questionNumber),
      )
      .filter((q) => q.eq(q.field('playerId'), args.playerId))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, { text: args.text })
      return existing._id
    }

    return await ctx.db.insert('answers', {
      playerId: args.playerId,
      weekId: args.weekId,
      questionNumber: args.questionNumber,
      text: args.text,
    })
  },
})

export const listByQuestion = query({
  args: { weekId: v.id('weeks'), questionNumber: v.number() },
  handler: async (ctx, args) => {
    const answers = await ctx.db
      .query('answers')
      .withIndex('by_week_question', (q) =>
        q.eq('weekId', args.weekId).eq('questionNumber', args.questionNumber),
      )
      .collect()

    const playersRaw = await ctx.db.query('players').collect()
    const playersWithUrl = await Promise.all(
      playersRaw.map(async (p) => ({
        ...p,
        photoUrl: p.photoStorageId ? await ctx.storage.getUrl(p.photoStorageId) : null,
      })),
    )
    const playerMap = Object.fromEntries(playersWithUrl.map((p) => [p._id, p]))

    return answers.map((a) => ({ ...a, player: playerMap[a.playerId] }))
  },
})

export const listByCorrectionBlock = query({
  args: {
    weekId: v.id('weeks'),
    questionNumbers: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.questionNumbers.length === 0) return []

    const allAnswers = await ctx.db
      .query('answers')
      .withIndex('by_week', (q) => q.eq('weekId', args.weekId))
      .collect()

    const filtered = allAnswers.filter((a) => args.questionNumbers.includes(a.questionNumber))

    const playersRaw = await ctx.db.query('players').collect()
    const playersWithUrl = await Promise.all(
      playersRaw.map(async (p) => ({
        ...p,
        photoUrl: p.photoStorageId ? await ctx.storage.getUrl(p.photoStorageId) : null,
      })),
    )
    const playerMap = Object.fromEntries(playersWithUrl.map((p) => [p._id, p]))

    return filtered.map((a) => ({ ...a, player: playerMap[a.playerId] }))
  },
})

export const myAnswer = query({
  args: {
    playerId: v.id('players'),
    weekId: v.id('weeks'),
    questionNumber: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('answers')
      .withIndex('by_week_question', (q) =>
        q.eq('weekId', args.weekId).eq('questionNumber', args.questionNumber),
      )
      .filter((q) => q.eq(q.field('playerId'), args.playerId))
      .first()
  },
})

export const attributePoints = mutation({
  args: { answerId: v.id('answers'), points: v.number() },
  handler: async (ctx, args) => {
    const answer = await ctx.db.get(args.answerId)
    if (!answer) throw new Error('Réponse introuvable')

    await ctx.db.patch(args.answerId, { points: args.points })

    // Recalcule le total du joueur pour cette semaine
    const allAnswers = await ctx.db
      .query('answers')
      .withIndex('by_week', (q) => q.eq('weekId', answer.weekId))
      .filter((q) => q.eq(q.field('playerId'), answer.playerId))
      .collect()

    const total = allAnswers.reduce((sum, a) => {
      const pts = a._id === args.answerId ? args.points : (a.points ?? 0)
      return sum + pts
    }, 0)

    const existingScore = await ctx.db
      .query('scores')
      .withIndex('by_week', (q) => q.eq('weekId', answer.weekId))
      .filter((q) => q.eq(q.field('playerId'), answer.playerId))
      .first()

    if (existingScore) {
      await ctx.db.patch(existingScore._id, { points: total })
    } else {
      await ctx.db.insert('scores', {
        playerId: answer.playerId,
        weekId: answer.weekId,
        points: total,
      })
    }
  },
})
