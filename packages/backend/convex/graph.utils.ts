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

export function posOrDefault(position?: { x?: number; y?: number }): CanvasPos {
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
) {
  graph.addNode(key, { position, ...extra });
}

export function posOf(graph: Graph, nodeKey: NodeKey) {
  if (!graph.hasNode(nodeKey)) {
    throw new Error(`posOf: node "${nodeKey}" is not in the graph`);
  }
  const rawPosition = (graph.getNodeAttribute(nodeKey, "position") ??
    {}) as Partial<CanvasPos>;
  return posOrDefault(rawPosition);
}

export function byCanvas(graph: Graph, a: NodeKey, b: NodeKey) {
  const positionA = posOf(graph, a);
  const positionB = posOf(graph, b);

  return (
    positionA.y - positionB.y || positionA.x - positionB.x || a.localeCompare(b)
  );
}

export function buildGraph(data: InputData) {
  const graph = new Graph({ type: "directed" });

  for (const node of data.nodes) {
    const key = toKey(node._id);
    const pos = posOrDefault(node.position);
    addNodeWithPosition(graph, key, pos);
  }

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

type ForkEntry = {
  fork: NodeKey;
  remaining: NodeKey[];
};

const getEligibleChildrenSorted = (
  graph: Graph,
  nodeKey: NodeKey,
  eligible: ReadonlySet<NodeKey>
) => {
  const children: NodeKey[] = [];
  const neighbors = graph.outNeighbors(nodeKey) as Iterable<NodeKey>;
  for (const neighbor of neighbors) {
    if (eligible.has(neighbor)) {
      children.push(neighbor);
    }
  }

  children.sort((first, second) => byCanvas(graph, first, second));
  return children;
};

const refreshForkEntry = (
  graph: Graph,
  entry: ForkEntry,
  eligible: ReadonlySet<NodeKey>
) => {
  entry.remaining = getEligibleChildrenSorted(graph, entry.fork, eligible);
};

const pickTopmostEligible = (graph: Graph, eligible: ReadonlySet<NodeKey>) => {
  if (eligible.size === 0) {
    return;
  }
  const candidates = Array.from(eligible);
  candidates.sort((first, second) => byCanvas(graph, first, second));
  return candidates[0];
};

/**
 * Returns a topologically valid order that follows
 * position-ordered DFS with backtracking (see rules above).
 *
 * The traversal keeps an `active` path tip, only extends that tip while it
 * has eligible children, and defers global jumps until the tip and every
 * fork on the stack run out of eligible continuations. Only then do we
 * pick the topmost remaining eligible node to begin a new path.
 */

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: relax
export function topoPathByCanvas(graph: Graph) {
  const nodes = Array.from(graph.nodes() as Iterable<NodeKey>);
  if (nodes.length === 0) {
    return [];
  }

  const indegree = new Map<NodeKey, number>();
  const eligible = new Set<NodeKey>();

  for (const nodeKey of nodes) {
    const degree = graph.inDegree(nodeKey);
    indegree.set(nodeKey, degree);
    if (degree === 0) {
      eligible.add(nodeKey);
    }
  }

  const order: NodeKey[] = [];
  const forkStack: ForkEntry[] = [];
  let active: NodeKey | undefined;

  const visit = (nodeKey: NodeKey) => {
    order.push(nodeKey);
    eligible.delete(nodeKey);
    const neighbors = graph.outNeighbors(nodeKey) as Iterable<NodeKey>;
    for (const child of neighbors) {
      const degree = indegree.get(child);
      if (degree === undefined) {
        continue;
      }
      const nextDegree = degree - 1;
      indegree.set(child, nextDegree);
      if (nextDegree === 0) {
        eligible.add(child);
      }
    }
    active = nodeKey;
  };

  while (order.length < nodes.length) {
    let next: NodeKey | undefined;

    if (active) {
      const children = getEligibleChildrenSorted(graph, active, eligible);
      const childCount = children.length;
      if (childCount === 0) {
        active = undefined;
      } else {
        next = children[0];
        if (childCount >= 2) {
          forkStack.push({
            fork: active,
            remaining: children.slice(1),
          });
        }
      }
    }

    if (!next) {
      while (forkStack.length > 0) {
        // biome-ignore lint/style/useAtIndex: relax
        const candidateEntry = forkStack[forkStack.length - 1];
        refreshForkEntry(graph, candidateEntry, eligible);
        if (candidateEntry.remaining.length === 0) {
          forkStack.pop();
          continue;
        }
        next = candidateEntry.remaining.shift();
        if (next) {
          break;
        }
      }
    }

    if (!next) {
      next = pickTopmostEligible(graph, eligible);
    }

    if (!next) {
      throw new Error(
        "topoPathByCanvas: graph contains a cycle or unreachable node"
      );
    }

    visit(next);
  }

  return order;
}

/**
 * Convenience wrapper used by the workflow service. It keeps the previous
 * behavior of filtering to nodes that participate in at least one edge.
 */
export function computeBranchOrderedExecutionAuto(data: InputData) {
  const graph = buildGraph(data);
  const order = topoPathByCanvas(graph);
  const involved = new Set();

  for (const edgeKey of graph.edges()) {
    involved.add(graph.source(edgeKey));
    involved.add(graph.target(edgeKey));
  }

  return order.filter((nodeKey) => involved.has(nodeKey));
}
