export const BRANCH_KEYS = ["if", "else"] as const;

export type BranchKey = (typeof BRANCH_KEYS)[number];

export type GraphNodeSnapshot = {
  readonly id: string;
  readonly workflowId: string;
  readonly type: string;
  readonly branchScopeId?: string | null;
  readonly branchKey?: string | null;
};

export type GraphEdgeSnapshot = {
  readonly id?: string;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly branchKey?: string | null;
};

export type EdgeConnectionInput = {
  readonly workflowId: string;
  readonly sourceNode: GraphNodeSnapshot;
  readonly targetNode: GraphNodeSnapshot;
  readonly existingOutgoingEdges: GraphEdgeSnapshot[];
  readonly requestedBranchKey?: string | null;
};

export type BranchMetadataAssignment = {
  scopeId?: string;
  branchKey?: BranchKey;
};

export type EdgeConnectionPlan = {
  readonly edgeBranchKey?: BranchKey;
  readonly assignment: BranchMetadataAssignment;
};

const branchKeySet = new Set<string>(BRANCH_KEYS);

export const normalizeBranchKey = (
  value?: string | null
): BranchKey | undefined => {
  if (!value) {
    return;
  }
  if (branchKeySet.has(value)) {
    return value as BranchKey;
  }
  throw new Error(`Unsupported branch key "${value}"`);
};

export const isBranchNodeType = (type: string) => type === "branch";

const ensureSameWorkflow = (
  node: GraphNodeSnapshot,
  workflowId: string
): void => {
  if (node.workflowId !== workflowId) {
    throw new Error("Nodes must belong to the same workflow.");
  }
};

const ensureRegularNodeHasSingleEdge = (
  node: GraphNodeSnapshot,
  existingOutgoingEdges: GraphEdgeSnapshot[]
) => {
  if (!isBranchNodeType(node.type) && existingOutgoingEdges.length >= 1) {
    throw new Error("Regular nodes may only have one outgoing edge.");
  }
};

const ensureBranchNodeLimits = (
  existingOutgoingEdges: GraphEdgeSnapshot[],
  branchKey: BranchKey
) => {
  if (existingOutgoingEdges.length >= BRANCH_KEYS.length) {
    throw new Error("Branch nodes may only define two outgoing edges.");
  }
  for (const edge of existingOutgoingEdges) {
    const existingKey = normalizeBranchKey(edge.branchKey);
    if (existingKey === branchKey) {
      throw new Error(`Branch already defines a "${branchKey}" edge.`);
    }
  }
};

const scopeOf = (node: GraphNodeSnapshot) =>
  isBranchNodeType(node.type) ? node.id : (node.branchScopeId ?? undefined);

const branchOf = (
  node: GraphNodeSnapshot,
  explicit?: BranchKey
): BranchKey | undefined => {
  if (isBranchNodeType(node.type)) {
    return explicit;
  }
  return normalizeBranchKey(node.branchKey);
};

const ensureScopeCompatibility = (
  sourceScope: string | undefined,
  targetScope: string | undefined
) => {
  if (targetScope && !sourceScope) {
    throw new Error(
      "Cannot connect nodes inside a branch from outside the branch."
    );
  }
  if (sourceScope && targetScope && sourceScope !== targetScope) {
    throw new Error("Cross-branch edges are not allowed.");
  }
};

const ensureBranchCompatibility = (
  sourceBranch: BranchKey | undefined,
  targetBranch: BranchKey | undefined
) => {
  if (targetBranch && !sourceBranch) {
    throw new Error("Branch metadata must remain consistent inside a branch.");
  }
  if (sourceBranch && targetBranch && sourceBranch !== targetBranch) {
    throw new Error("Cannot connect nodes from different branch legs.");
  }
};

const assignmentForTarget = (
  sourceScope: string | undefined,
  targetScope: string | undefined,
  sourceBranch: BranchKey | undefined,
  targetBranch: BranchKey | undefined
): BranchMetadataAssignment => {
  const assignment: BranchMetadataAssignment = {};
  if (sourceScope && !targetScope) {
    assignment.scopeId = sourceScope;
  }
  if (sourceBranch && !targetBranch) {
    assignment.branchKey = sourceBranch;
  }
  return assignment;
};

export const planEdgeConnection = (
  input: EdgeConnectionInput
): EdgeConnectionPlan => {
  const {
    workflowId,
    sourceNode,
    targetNode,
    existingOutgoingEdges,
    requestedBranchKey,
  } = input;

  ensureSameWorkflow(sourceNode, workflowId);
  ensureSameWorkflow(targetNode, workflowId);

  // could also be extracted as a helper, ensureEdgesAreNotSelfReferencing
  if (sourceNode.id === targetNode.id) {
    throw new Error("Self-referential edges are not allowed.");
  }

  ensureRegularNodeHasSingleEdge(sourceNode, existingOutgoingEdges);

  let normalizedBranchKey: BranchKey | undefined;
  if (isBranchNodeType(sourceNode.type)) {
    normalizedBranchKey = normalizeBranchKey(requestedBranchKey);
    if (!normalizedBranchKey) {
      throw new Error("Branch edges must include a branch key.");
    }
    ensureBranchNodeLimits(existingOutgoingEdges, normalizedBranchKey);
  } else if (requestedBranchKey) {
    throw new Error("Only branch nodes may specify a branch key.");
  }

  const sourceScope = scopeOf(sourceNode);
  const sourceBranch = branchOf(sourceNode, normalizedBranchKey);
  const targetScope = targetNode.branchScopeId ?? undefined;
  const targetBranch = normalizeBranchKey(targetNode.branchKey);

  ensureScopeCompatibility(sourceScope, targetScope);
  ensureBranchCompatibility(sourceBranch, targetBranch);

  const assignment = assignmentForTarget(
    sourceScope,
    targetScope,
    sourceBranch,
    targetBranch
  );
  const edgeBranchKey = isBranchNodeType(sourceNode.type)
    ? normalizedBranchKey
    : sourceBranch;

  return {
    edgeBranchKey,
    assignment,
  };
};
