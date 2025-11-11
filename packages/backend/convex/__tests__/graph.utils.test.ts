import assert from "node:assert/strict";
import test from "node:test";

import type { InputData, InputEdge, NodeKey } from "../graph.utils";
import { buildGraph, topoPathByCanvas } from "../graph.utils";

const runTraversal = (data: InputData): NodeKey[] => {
  const graph = buildGraph(data);
  return topoPathByCanvas(graph);
};

// ┌───────┐    ┌───────┐
// │ node1 ┼────► node2 │
// └───────┘    └───────┘

const assertTopologicalOrder = (order: NodeKey[], edges: InputEdge[]): void => {
  const positions = new Map<NodeKey, number>();
  for (const [index, key] of order.entries()) {
    positions.set(key, index);
  }
  for (const edge of edges) {
    const source = String(edge.sourceNodeId);
    const target = String(edge.targetNodeId);
    const sourceIndex = positions.get(source);
    const targetIndex = positions.get(target);
    assert.ok(
      sourceIndex !== undefined &&
        targetIndex !== undefined &&
        sourceIndex < targetIndex,
      `edge ${source} -> ${target} violates topological order`
    );
  }
};

test("linear chain drains without forks", () => {
  const data: InputData = {
    nodes: [
      { _id: "A", position: { x: 0, y: 0 } },
      { _id: "B", position: { x: 0, y: 10 } },
      { _id: "C", position: { x: 0, y: 20 } },
    ],
    edges: [
      { sourceNodeId: "A", targetNodeId: "B" },
      { sourceNodeId: "B", targetNodeId: "C" },
    ],
  };

  const order = runTraversal(data);
  assert.deepEqual(order, ["A", "B", "C"]);
  assertTopologicalOrder(order, data.edges);
});

test("single fork backtracks to the next sibling", () => {
  const data: InputData = {
    nodes: [
      { _id: "A", position: { x: 0, y: 0 } },
      { _id: "B", position: { x: 0, y: 10 } },
      { _id: "C", position: { x: 20, y: 10 } },
      { _id: "D", position: { x: 0, y: 20 } },
      { _id: "E", position: { x: 20, y: 20 } },
    ],
    edges: [
      { sourceNodeId: "A", targetNodeId: "B" },
      { sourceNodeId: "A", targetNodeId: "C" },
      { sourceNodeId: "B", targetNodeId: "D" },
      { sourceNodeId: "C", targetNodeId: "E" },
    ],
  };

  const order = runTraversal(data);
  assert.deepEqual(order, ["A", "B", "D", "C", "E"]);
  assertTopologicalOrder(order, data.edges);
});

test("nested forks respect stacked order", () => {
  const data: InputData = {
    nodes: [
      { _id: "A", position: { x: 0, y: 0 } },
      { _id: "B", position: { x: 0, y: 10 } },
      { _id: "C", position: { x: 20, y: 10 } },
      { _id: "D", position: { x: 0, y: 20 } },
      { _id: "E", position: { x: 20, y: 20 } },
      { _id: "F", position: { x: 30, y: 30 } },
    ],
    edges: [
      { sourceNodeId: "A", targetNodeId: "B" },
      { sourceNodeId: "A", targetNodeId: "C" },
      { sourceNodeId: "B", targetNodeId: "D" },
      { sourceNodeId: "B", targetNodeId: "E" },
      { sourceNodeId: "C", targetNodeId: "F" },
    ],
  };

  const order = runTraversal(data);
  assert.deepEqual(order, ["A", "B", "D", "E", "C", "F"]);
  assertTopologicalOrder(order, data.edges);
});

test("cross-branch dependencies resume delayed children", () => {
  const data: InputData = {
    nodes: [
      { _id: "A", position: { x: 0, y: 0 } },
      { _id: "B", position: { x: 0, y: 10 } },
      { _id: "X", position: { x: 20, y: 10 } },
      { _id: "C", position: { x: 10, y: 20 } },
    ],
    edges: [
      { sourceNodeId: "A", targetNodeId: "B" },
      { sourceNodeId: "A", targetNodeId: "X" },
      { sourceNodeId: "B", targetNodeId: "C" },
      { sourceNodeId: "X", targetNodeId: "C" },
    ],
  };

  const order = runTraversal(data);
  assert.deepEqual(order, ["A", "B", "X", "C"]);
  assertTopologicalOrder(order, data.edges);
});

test("multiple components pick the topmost restart", () => {
  const data: InputData = {
    nodes: [
      { _id: "A", position: { x: 0, y: 0 } },
      { _id: "B", position: { x: 0, y: 10 } },
      { _id: "C", position: { x: 0, y: 5 } },
      { _id: "D", position: { x: 0, y: 15 } },
    ],
    edges: [
      { sourceNodeId: "A", targetNodeId: "B" },
      { sourceNodeId: "C", targetNodeId: "D" },
    ],
  };

  const order = runTraversal(data);
  assert.deepEqual(order, ["A", "B", "C", "D"]);
  assertTopologicalOrder(order, data.edges);
});

test("equal positions fall back to key ordering", () => {
  const data: InputData = {
    nodes: [
      { _id: "Alpha", position: { x: 0, y: 0 } },
      { _id: "Beta", position: { x: 0, y: 0 } },
      { _id: "C1", position: { x: 0, y: 10 } },
      { _id: "D1", position: { x: 0, y: 10 } },
    ],
    edges: [
      { sourceNodeId: "Alpha", targetNodeId: "C1" },
      { sourceNodeId: "Beta", targetNodeId: "D1" },
    ],
  };

  const order = runTraversal(data);
  assert.deepEqual(order, ["Alpha", "C1", "Beta", "D1"]);
  assertTopologicalOrder(order, data.edges);
});

test("missing positions default to the origin", () => {
  const data: InputData = {
    nodes: [{ _id: "node-2" }, { _id: "node-1" }],
    edges: [],
  };

  const order = runTraversal(data);
  assert.deepEqual(order, ["node-1", "node-2"]);
  assertTopologicalOrder(order, data.edges);
});
