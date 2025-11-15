import {
  type Edge,
  Handle,
  type Node,
  Position,
  useNodeId,
  useNodesData,
  useReactFlow,
} from "@xyflow/react";
import { Check, Loader2, Split, X } from "lucide-react";
import type { CSSProperties } from "react";
import { BaseNode } from "@/components/base-node";

export type SwitchRouteDefinition = {
  id: string;
  label: string;
};

export const DEFAULT_SWITCH_ROUTES: readonly SwitchRouteDefinition[] = [
  { id: "match", label: "Match" },
  { id: "default", label: "Default" },
] as const;

type SwitchNodeData = {
  label?: string;
  inProgress?: boolean;
  result?: { status?: string };
  routes?: SwitchRouteDefinition[];
  usedSourceHandles?: string[];
};

const HANDLE_STYLE: CSSProperties = {
  width: "8px",
  height: "8px",
  borderRadius: "15px",
  backgroundColor: "white",
  border: "1px solid var(--color-gray-400)",
};

const computeHandleOffset = (index: number, total: number, gap = 15) => {
  if (total <= 1) {
    return 0;
  }
  const midpoint = (total - 1) / 2;
  return (index - midpoint) * gap;
};

const ensureRoutes = (routes?: SwitchRouteDefinition[]) =>
  routes && routes.length > 0 ? routes : [...DEFAULT_SWITCH_ROUTES];

const normalizeRouteLabel = (
  raw: SwitchRouteDefinition["label"],
  fallback: string
) => (raw && raw.length ? raw : fallback);

export const normalizeSwitchRoutes = (
  routes: unknown
): SwitchRouteDefinition[] => {
  if (!Array.isArray(routes)) {
    return [...DEFAULT_SWITCH_ROUTES];
  }

  const normalized: SwitchRouteDefinition[] = [];
  routes.forEach((raw, index) => {
    if (typeof raw === "string") {
      normalized.push({ id: raw, label: raw });
      return;
    }
    if (raw && typeof raw === "object") {
      const candidate = raw as {
        id?: unknown;
        label?: unknown;
        name?: unknown;
      };
      const id =
        typeof candidate.id === "string" ? candidate.id : `route-${index + 1}`;
      const label =
        typeof candidate.label === "string"
          ? candidate.label
          : typeof candidate.name === "string"
            ? candidate.name
            : id;
      normalized.push({ id, label });
    }
  });

  return normalized.length ? normalized : [...DEFAULT_SWITCH_ROUTES];
};

export const deriveSwitchRoutesFromParameters = (
  parameters?: Record<string, unknown>
) => {
  if (!parameters) {
    return [...DEFAULT_SWITCH_ROUTES];
  }
  if ("routes" in parameters) {
    return normalizeSwitchRoutes((parameters as { routes?: unknown }).routes);
  }
  if ("conditions" in parameters) {
    return normalizeSwitchRoutes(
      (parameters as { conditions?: unknown }).conditions
    );
  }
  if ("cases" in parameters) {
    return normalizeSwitchRoutes((parameters as { cases?: unknown }).cases);
  }
  return [...DEFAULT_SWITCH_ROUTES];
};

export function SwitchNode() {
  const nodeId = useNodeId();
  const node = useNodesData<Node<SwitchNodeData>>(nodeId ?? "");
  const routes = ensureRoutes(node?.data.routes);
  const reactFlowInstance = useReactFlow();
  const runtimeEdges = reactFlowInstance.getEdges() as Edge[];
  const runtimeHandles = new Set<string>();
  if (nodeId) {
    for (const edge of runtimeEdges) {
      if (edge.source === nodeId && typeof edge.sourceHandle === "string") {
        runtimeHandles.add(edge.sourceHandle);
      }
    }
  }
  const usedHandles = new Set([
    ...(node?.data.usedSourceHandles ?? []),
    ...runtimeHandles,
  ]);

  const statusBadge = (() => {
    if (node?.data.result?.status === "failed") {
      return (
        <X className="absolute right-0.5 bottom-0.5 h-3 w-3 text-red-500" />
      );
    }
    if (node?.data.result?.status === "success") {
      return (
        <Check className="absolute right-0.5 bottom-0.5 h-3 w-3 text-green-500" />
      );
    }
    return null;
  })();

  const Icon = node?.data.inProgress ? (
    <Loader2 className="animate-spin text-gray-500" />
  ) : (
    <Split className="h-10 w-10 rotate-90" />
  );

  const BASE_HEIGHT = 90;
  const HEIGHT_STEP = 30;
  const desiredHeight =
    BASE_HEIGHT + Math.max(0, routes.length - 2) * HEIGHT_STEP + HEIGHT_STEP;
  const paddingOffset = 30;
  const nodeHeight = Math.max(0, desiredHeight - paddingOffset);

  return (
    <BaseNode
      className="flex cursor-pointer items-center justify-center border-gray-400 bg-card p-4 text-center text-gray-400"
      style={{ height: nodeHeight, minHeight: BASE_HEIGHT }}
    >
      <div className="">
        {Icon}
        {statusBadge}
      </div>
      {/* <p className="mt-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {node?.data.label ?? "Switch"}
      </p> */}
      {/* <div className="mt-3 flex flex-col gap-1 text-[11px] text-muted-foreground">
        {routes.map((route) => (
          <div
            className="flex items-center justify-between rounded border border-dashed border-border px-2 py-1"
            key={route.id}
          >
            <span className="truncate">
              {normalizeRouteLabel(route.label, route.id)}
            </span>
            <span className="text-[9px] uppercase tracking-wide">
              {usedHandles.has(route.id) ? "linked" : "open"}
            </span>
          </div>
        ))}
      </div> */}
      <Handle
        id="switch-target"
        isConnectable
        isConnectableStart={false}
        position={Position.Left}
        style={{
          ...HANDLE_STYLE,
          top: "50%",
          transform: "translate(-50%, -50%)",
        }}
        type="target"
      />
      {routes.map((route, index) => {
        const offset = computeHandleOffset(index, routes.length, 30);
        const handleId = route.id;
        const isConnected = usedHandles.has(handleId);
        return (
          <Handle
            id={handleId}
            isConnectable={!isConnected}
            key={handleId}
            position={Position.Right}
            style={{
              ...HANDLE_STYLE,
              top: `calc(50% + ${offset}px)`,
              transform: "translate(50%, -50%)",
            }}
            type="source"
          />
        );
      })}
    </BaseNode>
  );
}
