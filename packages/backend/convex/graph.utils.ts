import Graph from "graphology";

export type NodeKey = string;
export type CanvasPos = { x: number; y: number };

export type InputNode = {
  _id: string | number;
  position?: { x?: number; y?: number };
};
export type InputEdge = {
  sourceNodeId: string | number;
  targetNodeId: string | number;
};
export type InputData = { nodes: InputNode[]; edges: InputEdge[] };

const toKey = (nodeIdentifier: string | number): NodeKey =>
  String(nodeIdentifier);

function posOrDefault(position?: { x?: number; y?: number }): CanvasPos {
  const x = Number(position?.x);
  const y = Number(position?.y);
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
  };
}

export function addNodeWithPosition(
  graph: Graph,
  key: NodeKey,
  position: CanvasPos,
  extra: Record<string, unknown> = {}
): void {
  graph.addNode(key, { position, ...extra });
}

export function posOf(graph: Graph, nodeKey: NodeKey): CanvasPos {
  if (!graph.hasNode(nodeKey)) {
    throw new Error(`posOf: node "${nodeKey}" is not in the graph`);
  }
  const rawPosition = (graph.getNodeAttribute(nodeKey, "position") ??
    {}) as Partial<CanvasPos>;
  return posOrDefault(rawPosition);
}

export function byCanvas(graph: Graph, a: NodeKey, b: NodeKey): number {
  const positionA = posOf(graph, a);
  const positionB = posOf(graph, b);
  return (
    positionA.y - positionB.y || positionA.x - positionB.x || a.localeCompare(b)
  );
}

export function buildGraph(data: InputData): Graph {
  const graph = new Graph({ type: "directed" });

  // 1) Add nodes (normalize keys) with positions
  for (const node of data.nodes) {
    const key = toKey(node._id);
    const pos = posOrDefault(node.position);
    addNodeWithPosition(graph, key, pos);
  }

  // 2) Add edges (normalize keys). Skip edges whose endpoints are missing.
  for (const edge of data.edges) {
    const sourceKey = toKey(edge.sourceNodeId);
    const targetKey = toKey(edge.targetNodeId);
    const hasSource = graph.hasNode(sourceKey);
    const hasTarget = graph.hasNode(targetKey);
    if (hasSource && hasTarget) {
      graph.addEdge(sourceKey, targetKey);
    }
  }

  return graph;
}

/**
 * Find all split nodes (outDegree > 1), ordered by canvas (top→bottom, then left→right).
 */
export function findSplitNodes(graph: Graph): NodeKey[] {
  const splits: NodeKey[] = [];
  for (const nodeKey of graph.nodes() as NodeKey[]) {
    if (graph.outDegree(nodeKey) > 1) {
      splits.push(nodeKey);
    }
  }
  return splits.sort((a, b) => byCanvas(graph, a, b));
}

/**
 * Label nodes by branch from a given split node.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: chill
export function assignBranchIds(
  graph: Graph,
  splitNodeKey: NodeKey
): Map<NodeKey, number> {
  if (!graph.hasNode(splitNodeKey)) {
    throw new Error(
      `assignBranchIds: split node "${splitNodeKey}" not found in the graph`
    );
  }

  const branchId = new Map<NodeKey, number>();
  branchId.set(splitNodeKey, -1);

  const children = (graph.outNeighbors(splitNodeKey) as NodeKey[])
    .slice()
    .sort((a, b) => byCanvas(graph, a, b));

  for (const [branchIndex, childKey] of children.entries()) {
    const stack: NodeKey[] = [childKey];
    while (stack.length > 0) {
      const current = stack.pop();
      if (current !== undefined && !branchId.has(current)) {
        branchId.set(current, branchIndex);
        const neighbors = graph.outNeighbors(current) as NodeKey[];
        for (const neighbor of neighbors) {
          if (!branchId.has(neighbor)) {
            stack.push(neighbor);
          }
        }
      }
    }
  }

  return branchId;
}

/**
 * Kahn's algorithm variant that drains one branch fully before the next.
 */

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: chill
export function topoDrainByBranch(
  graph: Graph,
  branchId: ReadonlyMap<NodeKey, number>
): NodeKey[] {
  const indegree = new Map<NodeKey, number>();
  for (const nodeKey of graph.nodes() as NodeKey[]) {
    indegree.set(nodeKey, graph.inDegree(nodeKey));
  }

  const queues = new Map<number, NodeKey[]>(); // branch -> nodes (sorted by canvas)

  const push = (nodeKey: NodeKey) => {
    const branch = branchId.get(nodeKey);
    const normalizedBranch = branch ?? Number.MAX_SAFE_INTEGER;
    const existingQueue = queues.get(normalizedBranch) ?? [];
    existingQueue.push(nodeKey);
    existingQueue.sort((first, second) => byCanvas(graph, first, second));
    queues.set(normalizedBranch, existingQueue);
  };

  for (const nodeKey of graph.nodes() as NodeKey[]) {
    if ((indegree.get(nodeKey) ?? 0) === 0) {
      push(nodeKey);
    }
  }

  const order: NodeKey[] = [];

  const nextBranchId = (): number => {
    let best: number | undefined;
    for (const branch of queues.keys()) {
      if (best === undefined || branch < best) {
        best = branch;
      }
    }
    if (best === undefined) {
      throw new Error("topoDrainByBranch: no available branches");
    }
    return best;
  };

  while (queues.size) {
    const branch = nextBranchId();
    const queue = queues.get(branch);

    if (!queue || queue.length === 0) {
      queues.delete(branch);
    } else {
      const current = queue.shift();
      if (current !== undefined) {
        if (queue.length === 0) {
          queues.delete(branch);
        }

        order.push(current);

        const neighbors = graph.outNeighbors(current) as NodeKey[];
        for (const neighbor of neighbors) {
          const degree = (indegree.get(neighbor) ?? 0) - 1;
          indegree.set(neighbor, degree);
          if (degree === 0) {
            push(neighbor);
          }
        }
      } else if (queue.length === 0) {
        queues.delete(branch);
      }
    }
  }

  return order;
}

/**
 * Convenience: compute branch-draining order automatically.
 * - Builds branchIds from the highest/leftmost split node (if any).
 * - Falls back to "no branches labeled" if no split exists.
 * - Filters to nodes that are part of at least one edge (like your original code).
 */
export function computeBranchOrderedExecutionAuto(data: InputData): NodeKey[] {
  const graph = buildGraph(data);

  // Detect split node (if none, we still produce a valid topo order)
  const splits = findSplitNodes(graph);
  const branchId = splits.length
    ? assignBranchIds(graph, splits[0])
    : new Map<NodeKey, number>();

  const order = topoDrainByBranch(graph, branchId);

  // Keep only nodes that are involved in at least one edge
  const involved = new Set<NodeKey>();

  for (const edgeKey of graph.edges()) {
    involved.add(graph.source(edgeKey) as NodeKey);
    involved.add(graph.target(edgeKey) as NodeKey);
  }

  return order.filter((n) => involved.has(n));
}
