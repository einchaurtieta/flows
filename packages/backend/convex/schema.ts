import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  workflows: defineTable({
    name: v.string(),
    version: v.number(),
  }),
  nodes: defineTable({
    workflowId: v.id("workflows"),
    name: v.string(),
    type: v.union(v.literal("initial"), v.literal("trigger")),
    position: v.object({
      x: v.number(),
      y: v.number(),
    }),
  }).index("by_workflow", ["workflowId"]),
  edges: defineTable({
    workflowId: v.id("workflows"),
    sourceNodeId: v.id("nodes"),
    targetNodeId: v.id("nodes"),
    sourceHandle: v.optional(v.string()),
    targetHandle: v.optional(v.string()),
  }).index("by_workflow", ["workflowId"]),
});
