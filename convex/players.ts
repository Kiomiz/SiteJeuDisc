import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('players').collect()
  },
})

export const get = query({
  args: { playerId: v.id('players') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.playerId)
  },
})

export const create = mutation({
  args: {
    pseudo: v.string(),
    avatar: v.string(),
    color: v.string(),
    photoStorageId: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('players')
      .withIndex('by_pseudo', (q) => q.eq('pseudo', args.pseudo))
      .first()
    if (existing) throw new Error('Ce pseudo est déjà pris')
    return await ctx.db.insert('players', args)
  },
})

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl()
  },
})
