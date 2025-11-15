// biome-ignore lint/performance/noBarrelFile: <explanation>
export {
  BRANCH_KEYS,
  type BranchKey,
  type BranchMetadataAssignment,
  type EdgeConnectionInput,
  type EdgeConnectionPlan,
  type GraphEdgeSnapshot,
  type GraphNodeSnapshot,
  isBranchNodeType,
  normalizeBranchKey,
  planEdgeConnection,
} from "./branching.js";
