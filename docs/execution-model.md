# Execution Model v2

## Why revisit the algorithm?

The current executor precomputes a single linear `order` array and runs every node in that sequence. That works for strictly linear flows, but it breaks once nodes need to branch based on runtime data. The new workflow constraints—one outgoing edge per regular node, explicit parallelization, and no cross-branch wiring—give us clearer semantics but also make the position-based traversal unnecessary. We need an executor that follows graph intent, not canvas coordinates.

## Core constraints

1. **Single outbound edge** for regular nodes. Control-flow decisions happen only inside dedicated nodes (Parallel/Fork, Merge/Join, Switch/If-Else later).
2. **Parallel node fan-out** creates isolated branches. Nodes inside different branches may not connect directly; reconvergence must go through a Merge.
3. **Join/Merge nodes** define both synchronization (All, First, N-of-M, etc.) and data semantics (concat, reducer, key-join).
4. **No cross-branch edges** outside Merge nodes. This prevents accidental data races and keeps the execution DAG well-defined.

These invariants should be enforced at authoring time (graph validation) so the runtime can assume well-formed flows.

## Runtime shape

Instead of a precomputed linear order, the executor maintains an **eligible frontier**:

- Initialize the frontier with every node whose indegree is zero (typically the trigger).
- When a node finishes, inspect its outgoing edge(s):
  - Regular nodes have at most one successor; enqueue it when all of its prerequisites have completed.
  - Parallel nodes enqueue the first node of each branch, tagging them with branch metadata so reconvergence logic knows their origin.
- Merge nodes wait until their policy is satisfied (e.g., “All branches done”) before emitting outputs or marking downstream nodes eligible.

When multiple nodes are simultaneously eligible, we can still use a deterministic tiebreaker (e.g., lexicographic on node id) but no longer depend on canvas positions.

This “cursor” loop is simple:

```text
while frontier not empty:
  next = pick(frontier)
  result = run(next)
  mark next as completed
  push satisfied successors into frontier
```

## Data and schema implications

To enable this runtime, the stored graph should capture:

- Edge metadata for control nodes (e.g., switch-case labels for If/Else, branch id for Parallel).
- Node typing (regular, Parallel, Merge, Trigger, Terminal) so the executor knows which transition rules to apply.
- Optional execution policies on Merge nodes (sync requirement, timeout, reducer strategy).

Validation must ensure the constraints above plus DAG acyclicity.

## Suggested rollout plan

1. **Schema & validation**
   - Update Convex schema for nodes/edges to encode node kinds and control metadata.
   - Add backend validator that enforces single outbound edges, branch isolation, and Merge-only reconvergence.

2. **Graph utilities**
   - Replace `computeBranchOrderedExecutionAuto` with helpers that build adjacency lists, indegree counts, and branch descriptors—no positional ordering.
   - Provide deterministic `pick(frontier)` helper (simple lexicographic is fine initially).

3. **Executor refactor**
   - Rework `theWorkflow` so it consumes the graph structure rather than a linear order array.
   - Implement Parallel and Merge semantics, still iterating serially for now but structured for future concurrency.

4. **Future control nodes**
   - Once the base runtime works, add specialized nodes (If/Else, Wait, Join variants) on top of the shared control primitives.

Documenting the model now keeps the team aligned before we touch code, and it gives us a checklist for the upcoming implementation work.

## Next steps

1. **Editor integration**: expose switch handles in the canvas, call the shared `planEdgeConnection` helper for optimistic validation, and include `branchKey` when persisting edges.
2. **Execution engine**: swap the linear `order` loop for the frontier-based scheduler that reads branch metadata (`branchScopeId`, `branchKey`) to decide which nodes become eligible after a Switch node runs.
3. **Merge semantics**: design and validate Join/Merge nodes so reconvergence obeys the same shared rules (including future policies like All/First/N-of-M) before adding more control primitives.
