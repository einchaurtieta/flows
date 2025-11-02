import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, query } from "./_generated/server";

export const seed = internalMutation(async (ctx) => {
  const existingWorkflows = await ctx.db.query("workflows").collect();

  if (existingWorkflows.length > 0) {
    return;
  }

  const workflowId = await ctx.db.insert("workflows", {
    name: "Example",
    version: 1,
  });

  await ctx.db.insert("nodes", {
    workflowId,
    name: "Start",
    type: "initial",
    position: {
      x: 0,
      y: 0,
    },
  });

  // const triggerNodeId = await ctx.db.insert("nodes", {
  //   workflowId,
  //   name: "User Signup Trigger",
  //   type: "trigger",
  //   position: {
  //     x: 260,
  //     y: 100,
  //   },
  // });

  // await ctx.db.insert("edges", {
  //   workflowId,
  //   sourceNodeId: initialNodeId,
  //   targetNodeId: triggerNodeId,
  //   sourceHandle: "output",
  //   targetHandle: "input",
  // });
});

export const getWorflow = query({
  args: {
    workflowId: v.string(),
  },
  handler: async (ctx, args) => {
    const [nodes] = await Promise.all([
      ctx.db
        .query("nodes")
        .withIndex("by_workflow", (_query) =>
          _query.eq("workflowId", args.workflowId as Id<"workflows">)
        )
        .collect(),
    ]);

    if (!nodes) {
      return null;
    }

    return {
      workflow: {
        nodes,
      },
    };
  },
});
