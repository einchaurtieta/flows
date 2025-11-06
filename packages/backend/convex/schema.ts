import { vWorkflowId } from "@convex-dev/workflow";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  workflows: defineTable({
    name: v.string(),
    version: v.number(),
    currentRunId: v.optional(vWorkflowId),
  }),
  nodes: defineTable({
    workflowId: v.id("workflows"),
    name: v.string(),
    type: v.union(v.literal("trigger"), v.literal("http")),
    position: v.object({
      x: v.number(),
      y: v.number(),
    }),
    parameters: v.optional(v.record(v.string(), v.any())),
  }).index("by_workflow", ["workflowId"]),
  edges: defineTable({
    workflowId: v.id("workflows"),
    sourceNodeId: v.id("nodes"),
    targetNodeId: v.id("nodes"),
    sourceHandle: v.optional(v.string()),
    targetHandle: v.optional(v.string()),
  }).index("by_workflow", ["workflowId"]),
});
