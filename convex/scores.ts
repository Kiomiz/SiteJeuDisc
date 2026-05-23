import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

export const byWeek = query({
  args: { weekId: v.id('weeks') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('scores')
      .withIndex('by_week', (q) => q.eq('weekId', args.weekId))
      .collect()
  },
})

export const allTime = query({
  args: {},
  handler: async (ctx) => {
    const scores = await ctx.db.query('scores').collect()
    const players = await ctx.db.query('players').collect()

    const totals: Record<string, number> = {}
    for (const s of scores) {
      totals[s.playerId] = (totals[s.playerId] ?? 0) + s.points
    }

    return players
      .map((p) => ({ player: p, total: totals[p._id] ?? 0 }))
      .sort((a, b) => b.total - a.total)
  },
})

export const add = mutation({
  args: {
    playerId: v.id('players'),
    weekId: v.id('weeks'),
    points: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('scores', args)
  },
})
