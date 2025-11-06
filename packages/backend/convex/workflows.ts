import { vWorkflowId, WorkflowManager } from "@convex-dev/workflow";
import { v } from "convex/values";
import Graph from "graphology";
import { topologicalSort } from "graphology-dag/topological-sort";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";

export const workflow = new WorkflowManager(components.workflow);

export const seed = internalMutation(async (ctx) => {
  const existingWorkflows = await ctx.db.query("workflows").collect();

  if (existingWorkflows.length > 0) {
    return;
  }

  const workflowId = await ctx.db.insert("workflows", {
    name: "Example",
    version: 1,
  });

  const triggerNodeId = await ctx.db.insert("nodes", {
    workflowId,
    name: "Trigger",
    type: "trigger",
    position: {
      x: 0,
      y: 0,
    },
  });

  const httpNodeId = await ctx.db.insert("nodes", {
    workflowId,
    name: "Http",
    type: "http",
    position: {
      x: 0,
      y: 0,
    },
    parameters: {
      url: "https://pokeapi.co/api/v2/pokemon/ditto",
      method: "GET",
    },
  });

  await ctx.db.insert("edges", {
    workflowId,
    sourceNodeId: triggerNodeId,
    targetNodeId: httpNodeId,
    sourceHandle: "output",
    targetHandle: "input",
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

export const theWorkflow = workflow.define({
  args: {
    id: v.id("workflows"),
  },
  handler: async (step, args) => {
    const data = await step.runQuery(internal.workflows.exampleQuery, {
      id: args.id,
    });

    const graph = await step.runAction(internal.workflows.graphAction, {
      graph: {
        nodes: data.nodes,
        edges: data.edges,
      },
    });

    let context: Record<string, unknown> = {};

    for (const nodeId of JSON.parse(graph)) {
      const node = data.nodes.find((n) => n._id === nodeId);

      if (node?.type === "http") {
        const httpResult = await step.runAction(internal.workflows.httpAction, {
          node,
          context,
        });

        context = httpResult;
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

export const graphAction = internalAction({
  args: {
    graph: v.any(),
  },
  handler: (_, args) => {
    const graph = new Graph({ type: "directed" });

    for (const node of args.graph.nodes) {
      graph.addNode(node._id);
    }

    for (const edge of args.graph.edges) {
      graph.addEdge(edge.sourceNodeId, edge.targetNodeId);
    }

    const sorted = topologicalSort(graph);

    return JSON.stringify(sorted);
  },
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

export const kickoffWorkflow = mutation({
  handler: async (ctx) => {
    const id = await workflow.start(ctx, internal.workflows.theWorkflow, {
      id: "jh764q8p3p7sa56e23zjw58vt57tp4gn" as Id<"workflows">,
    });

    await ctx.db.patch("jh764q8p3p7sa56e23zjw58vt57tp4gn" as Id<"workflows">, {
      currentRunId: id,
    });
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
