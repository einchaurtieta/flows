import { vWorkflowId, WorkflowManager } from "@convex-dev/workflow";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { computeBranchOrderedExecutionAuto } from "./graph.utils";

export const workflow = new WorkflowManager(components.workflow);

export const seed = internalMutation(async (ctx) => {
  // const existingWorkflows = await ctx.db.query("workflows").collect();

  // if (existingWorkflows.length > 0) {
  //   return;
  // }

  // const workflowId = await ctx.db.insert("workflows", {
  //   name: "Example",
  //   version: 1,
  // });
  const workflowId = "jh764q8p3p7sa56e23zjw58vt57tp4gn" as Id<"workflows">;

  await ctx.db.insert("nodes", {
    workflowId,
    name: "Trigger",
    type: "trigger",
    position: {
      x: 0,
      y: 0,
    },
  });

  await ctx.db.insert("nodes", {
    workflowId,
    name: "Http",
    type: "http",
    position: {
      x: 0,
      y: 0,
    },
    parameters: {
      method: "GET",
      url: "https://pokeapi.co/api/v2/pokemon/ditto",
    },
  });

  await ctx.db.insert("nodes", {
    workflowId,
    name: "Http",
    type: "http",
    position: {
      x: 0,
      y: 0,
    },
    parameters: {
      method: "GET",
      url: "https://pokeapi.co/api/v2/pokemon/ditto",
    },
  });
  await ctx.db.insert("nodes", {
    workflowId,
    name: "Wait",
    type: "wait",
    position: {
      x: 0,
      y: 0,
    },
    parameters: {
      duration: 3000,
    },
  });
});

export const getWorflow = query({
  args: {
    workflowId: v.id("workflows"),
  },
  handler: async (ctx, args) => {
    const [_workflow, nodes, edges] = await Promise.all([
      ctx.db.get(args.workflowId),
      ctx.db
        .query("nodes")
        .withIndex("by_workflow", (_query) =>
          _query.eq("workflowId", args.workflowId)
        )
        .collect(),
      ctx.db
        .query("edges")
        .withIndex("by_workflow", (_query) =>
          _query.eq("workflowId", args.workflowId)
        )
        .collect(),
    ]);

    return {
      workflow: _workflow,
      nodes,
      edges,
    };
  },
});

export const fireWorkflowProcess = mutation({
  args: {
    id: v.id("workflows"),
  },
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(internal.workflows.exampleQuery, {
      id: args.id,
    });

    const sorted = computeBranchOrderedExecutionAuto({
      nodes: data.nodes,
      edges: data.edges,
    });

    const id = await workflow.start(ctx, internal.workflows.theWorkflow, {
      id: args.id,
      nodes: data.nodes,
      order: sorted as string[],
    });

    await ctx.db.patch(args.id, {
      currentRunId: id,
    });
  },
});

export const theWorkflow = workflow.define({
  args: {
    id: v.id("workflows"),
    order: v.array(v.string()),
    nodes: v.array(v.any()),
  },
  handler: async (step, args) => {
    let context: Record<string, unknown> = {};

    for (const nodeId of args.order) {
      const node = args.nodes.find((n) => n._id === nodeId);

      if (node?.type === "trigger") {
        const triggerResult = await step.runAction(
          internal.workflows.triggerAction,
          { node }
        );

        context = triggerResult;
      }

      if (node?.type === "http") {
        const httpResult = await step.runAction(internal.workflows.httpAction, {
          node,
          context,
        });

        context = httpResult;
      }

      if (node?.type === "wait") {
        await step.runAction(internal.workflows.waitAction, { node });
      }
    }
  },
});

export const httpAction = internalAction({
  args: {
    node: v.any(),
    context: v.any(),
  },
  handler: async (_, args) => {
    const data = await fetch(args.node.parameters.url);

    return await data.json();
  },
});

export const waitAction = internalAction({
  args: {
    node: v.any(),
  },
  handler: async (_, args) => {
    await new Promise((resolve) =>
      setTimeout(resolve, args.node.parameters.duration)
    );
  },
});

export const triggerAction = internalAction({
  args: {
    node: v.any(),
  },
  handler: async (_, _args) => ({
    triggeredAt: new Date().toISOString(),
  }),
});

export const exampleQuery = internalQuery({
  args: { id: v.id("workflows") },
  handler: async (ctx, args) => {
    const _workflow = await ctx.db.get(args.id);

    const [nodes, edges] = await Promise.all([
      ctx.db
        .query("nodes")
        .withIndex("by_workflow", (_query) => _query.eq("workflowId", args.id))
        .collect(),
      ctx.db
        .query("edges")
        .withIndex("by_workflow", (_query) => _query.eq("workflowId", args.id))
        .collect(),
    ]);

    return {
      workflow: _workflow,
      nodes,
      edges,
    };
  },
});

export const getStepStatus = query({
  args: {
    workflowId: vWorkflowId,
  },
  handler: async (ctx, { workflowId }) => {
    const { journalEntries } = await ctx.runQuery(
      components.workflow.journal.load,
      { workflowId }
    );

    return journalEntries
      .sort((a, b) => a.stepNumber - b.stepNumber)
      .filter(
        (e) =>
          e.step.name !== "workflows:graphAction" &&
          e.step.name !== "workflows:exampleQuery"
      )
      .map((e) => ({
        nodeId: e.step.args.node?._id || null,
        stepNumber: e.stepNumber,
        name: e.step.name,
        result: e.step.runResult?.kind ?? null,
        startedAt: e.step.startedAt ?? null,
        completedAt: e.step.completedAt ?? null,
        data:
          e.step.runResult?.kind === "success"
            ? e.step.runResult.returnValue
            : null,
        status: e.step.inProgress
          ? "running"
          : (e.step.runResult?.kind ?? "pending"),
      }));
  },
});

export const updateNodePosition = mutation({
  args: {
    nodeId: v.id("nodes"),
    positionX: v.number(),
    positionY: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.nodeId, {
      position: {
        x: args.positionX,
        y: args.positionY,
      },
    });
  },
});

export const removeNode = mutation({
  args: {
    nodeId: v.id("nodes"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.nodeId);
  },
});

export const removeEdge = mutation({
  args: {
    edgeId: v.id("edges"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.edgeId);
  },
});

export const createRandomNode = mutation({
  args: {
    workflowId: v.id("workflows"),
  },
  handler: async (ctx, args) => {
    const nodes = ["http", "wait"];
    const randomType = nodes[Math.floor(Math.random() * nodes.length)] as
      | "trigger"
      | "http"
      | "wait";

    const num = 400;

    await ctx.db.insert("nodes", {
      workflowId: args.workflowId,
      name: "New Node",
      type: randomType,
      parameters:
        randomType === "http"
          ? {
              method: "GET",
              url: "https://pokeapi.co/api/v2/pokemon/ditto",
            }
          : randomType === "wait"
            ? {
                duration: 2000,
              }
            : {},
      position: {
        x: Math.floor(Math.random() * num),
        y: Math.floor(Math.random() * num),
      },
    });
  },
});

export const addEdge = mutation({
  args: {
    workflowId: v.id("workflows"),
    sourceNodeId: v.id("nodes"),
    targetNodeId: v.id("nodes"),
    // sourceHandle: v.string(),
    // targetHandle: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("edges", {
      workflowId: args.workflowId,
      sourceNodeId: args.sourceNodeId,
      targetNodeId: args.targetNodeId,
      // sourceHandle: args.sourceHandle,
      // targetHandle: args.targetHandle,
    });
  },
});
