import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

export const listByWeek = query({
  args: { weekId: v.id('weeks') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('questions')
      .withIndex('by_week', (q) => q.eq('weekId', args.weekId))
      .collect()
  },
})

export const create = mutation({
  args: {
    weekId: v.id('weeks'),
    number: v.number(),
    text: v.string(),
    answer: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('questions', args)
  },
})

export const clearAndSeed = mutation({
  args: {
    weekId: v.id('weeks'),
    questions: v.array(
      v.object({
        number: v.number(),
        text: v.string(),
        category: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('questions')
      .withIndex('by_week', (q) => q.eq('weekId', args.weekId))
      .collect()
    for (const q of existing) await ctx.db.delete(q._id)
    for (const q of args.questions) {
      await ctx.db.insert('questions', { weekId: args.weekId, ...q })
    }
  },
})
