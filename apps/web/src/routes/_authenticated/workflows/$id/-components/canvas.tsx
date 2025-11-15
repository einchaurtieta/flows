import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeTypes,
  ReactFlow,
  SelectionMode,
  useNodeId,
  useNodesData,
} from "@xyflow/react";
import {
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import "@xyflow/react/dist/style.css";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@flows/backend/convex/_generated/api.js";
import type { Doc, Id } from "@flows/backend/convex/_generated/dataModel.js";
import {
  HttpGetConfigPanel,
  type HttpGetParameterValues,
  httpGetNode,
} from "@flows/nodes/examples";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  Clock,
  Globe,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { WorkflowNode } from "@/components/node";
import { PlaceholderNode } from "@/components/placeholder-node";
import {
  deriveSwitchRoutesFromParameters,
  SwitchNode,
} from "@/components/switch-node";
import { TriggerNode } from "@/components/trigger-node";
import type { NodeParameters } from "@/lib/nodes/definitions";
import {
  hydrateNodeParameters,
  isRegisteredNodeType,
} from "@/lib/nodes/definitions";
import { Route } from "../route";

const nodeComponents = {
  initial: () => (
    <PlaceholderNode>
      <div className="flex items-center justify-center">
        <Plus />
      </div>
    </PlaceholderNode>
  ),
  trigger: () => (
    <TriggerNode>
      <ArrowRight className="h-10 w-10" />
    </TriggerNode>
  ),
  wait: () => {
    const id = useNodeId();
    const node = useNodesData<Node & { data: { result: { status: string } } }>(
      id ?? ""
    );

    return (
      <WorkflowNode isConnectable={!node?.data.isConnected}>
        {node?.data.inProgress ? (
          <Loader2 className="h-10 w-10 animate-spin" />
        ) : (
          <Clock className="h-10 w-10" />
        )}
        {node?.data.result?.status === "failed" && (
          <X
            className="absolute right-0.5 bottom-0.5 text-red-500"
            height={"10px"}
            width={"10px"}
          />
        )}
        {node?.data.result?.status === "success" && (
          <Check
            className="absolute right-0.5 bottom-0.5 text-green-500"
            height={"10px"}
            width={"10px"}
          />
        )}
      </WorkflowNode>
    );
  },
  http: () => {
    const id = useNodeId();
    const node = useNodesData<Node & { data: { result: { status: string } } }>(
      id ?? ""
    );

    return (
      <WorkflowNode isConnectable={!node?.data.isConnected}>
        {node?.data.inProgress ? (
          <Loader2 className="h-10 w-10 animate-spin" />
        ) : (
          <Globe className="h-10 w-10" />
        )}
        {node?.data.result?.status === "failed" && (
          <X
            className="absolute right-0.5 bottom-0.5 text-red-500"
            height={"10px"}
            width={"10px"}
          />
        )}
        {node?.data.result?.status === "success" && (
          <Check
            className="absolute right-0.5 bottom-0.5 text-green-500"
            height={"10px"}
            width={"10px"}
          />
        )}
      </WorkflowNode>
    );
  },
  switch: SwitchNode,
} as const satisfies NodeTypes;

type Step = {
  nodeId: string;
  result: "success" | "failed" | "canceled" | null | undefined;
  inProgress: boolean;
  // biome-ignore lint/suspicious/noExplicitAny: chill for now
  data: any;
};

type EdgeWithHandles = Doc<"edges"> & {
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

function isEdgeAnimated(edge: Doc<"edges">, steps: Step[]) {
  const sourceNodeStep = steps.find(
    (step) => step.nodeId === edge.sourceNodeId
  );
  const targetNodeStep = steps.find(
    (step) => step.nodeId === edge.targetNodeId
  );

  return sourceNodeStep && targetNodeStep && targetNodeStep.inProgress;
}

export function Canvas() {
  const { id } = Route.useParams() as { id: Id<"workflows"> };
  const navigate = useNavigate();

  const { data: workflow } = useSuspenseQuery(
    convexQuery(api.workflows.getWorflow, {
      workflowId: id,
    })
  );

  const { data: steps } = useQuery(
    convexQuery(api.workflows.getStepStatus, {
      // biome-ignore lint/style/noNonNullAssertion: relax
      // biome-ignore lint/suspicious/noNonNullAssertedOptionalChain: chill
      workflowId: workflow.workflow?.currentRunId!,
    })
  );

  const mutation = useConvexMutation(api.workflows.fireWorkflowProcess);
  const updatePosition = useConvexMutation(api.workflows.updateNodePosition);
  const removeEdge = useConvexMutation(api.workflows.removeEdge);
  const addEdgeMutation = useConvexMutation(api.workflows.addEdge);
  const removeNode = useConvexMutation(api.workflows.removeNode);
  const addRandomNode = useConvexMutation(api.workflows.createRandomNode);
  const clearWorflowRun = useConvexMutation(api.workflows.clearWorkflowRuns);

  const formattedWorkflowNodes = useMemo(() => {
    if (!workflow?.nodes) {
      return [] as Node[];
    }

    const usedHandlesByNode = new Map<string, Set<string>>();
    const edgesWithHandles = workflow.edges as EdgeWithHandles[];
    for (const edge of edgesWithHandles ?? []) {
      if (!edge.sourceHandle) {
        continue;
      }
      const existing =
        usedHandlesByNode.get(edge.sourceNodeId) ?? new Set<string>();
      existing.add(edge.sourceHandle);
      usedHandlesByNode.set(edge.sourceNodeId, existing);
    }

    return workflow.nodes.map((node) => {
      const usedHandles = Array.from(
        usedHandlesByNode.get(node._id as string) ?? []
      );
      const rawParameters = node.parameters as
        | Record<string, unknown>
        | undefined;
      let hydratedParameters: unknown;
      if (isRegisteredNodeType(node.type)) {
        hydratedParameters = hydrateNodeParameters(node.type, rawParameters);
      }
      const switchParameters =
        node.type === "switch"
          ? (hydratedParameters as NodeParameters<"switch"> | undefined)
          : undefined;
      const routes =
        node.type === "switch"
          ? deriveSwitchRoutesFromParameters(rawParameters ?? switchParameters)
          : undefined;

      return {
        id: node._id as string,
        data: {
          label: node.name,
          inProgress: steps?.find((_step) => _step.nodeId === node._id)
            ?.inProgress,
          isConnected:
            workflow.edges?.some((edge) => edge.sourceNodeId === node._id) ??
            false,
          result: steps?.find((_step) => _step.nodeId === node._id)?.data,
          routes,
          parameters: hydratedParameters,
          usedSourceHandles: usedHandles,
        },
        position: {
          x: node.position.x,
          y: node.position.y,
        },
        type: node.type,
      } as Node;
    }) as Node[];
  }, [workflow?.nodes, workflow?.edges, steps]);

  const formattedEdges = useMemo(() => {
    if (!workflow?.edges) {
      return [] as Edge[];
    }
    const edgesWithHandles = workflow.edges as EdgeWithHandles[];
    return edgesWithHandles.map((edge) => ({
      id: edge._id as string,
      source: edge.sourceNodeId,
      target: edge.targetNodeId,
      // biome-ignore lint/suspicious/noExplicitAny: FIX
      animated: isEdgeAnimated(edge, steps || ([] as any)),
      sourceHandle: edge.sourceHandle ?? undefined,
      targetHandle: edge.targetHandle ?? undefined,
    })) as Edge[];
  }, [workflow?.edges, steps]);

  const [pendingRemovalIds, setPendingRemovalIds] = useState<Set<string>>(
    () => new Set()
  );
  const [nodes, setNodes] = useState<Node[]>(formattedWorkflowNodes || []);
  const [edges, setEdges] = useState<Edge[]>(formattedEdges || []);

  useEffect(() => {
    setNodes((prev) => {
      const prevById = new Map(prev.map((node) => [node.id, node]));

      return (formattedWorkflowNodes || [])
        .filter((node) => !pendingRemovalIds.has(node.id))
        .map((node) => {
          const prevNode = prevById.get(node.id);
          return prevNode ? { ...node, selected: prevNode.selected } : node;
        });
    });
  }, [formattedWorkflowNodes, pendingRemovalIds]);

  useEffect(() => {
    if (!formattedWorkflowNodes) {
      return;
    }

    setPendingRemovalIds((prev) => {
      if (!prev.size) {
        return prev;
      }

      const serverIds = new Set(formattedWorkflowNodes.map((node) => node.id));
      let changed = false;
      const next = new Set<string>();

      for (const pid of prev) {
        if (serverIds.has(pid)) {
          next.add(pid);
        } else {
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [formattedWorkflowNodes]);

  useEffect(() => {
    setEdges((prev) => {
      const prevById = new Map(prev.map((edge) => [edge.id, edge]));

      return (formattedEdges || []).map((edge) => {
        const prevEdge = prevById.get(edge.id);
        return prevEdge ? { ...edge, selected: prevEdge.selected } : edge;
      });
    });
  }, [formattedEdges]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot));

      for (const change of changes) {
        if (change.type === "remove") {
          setPendingRemovalIds((prev) => {
            const next = new Set(prev);
            next.add(change.id);
            return next;
          });

          removeNode({ nodeId: change.id as Id<"nodes"> });
        }
      }
    },
    [removeNode]
  );

  const onNodeDragStop = useCallback(
    (_: unknown, node: Node) => {
      updatePosition({
        nodeId: node.id as Id<"nodes">,
        position: node.position,
      });
    },
    [updatePosition]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot));

      addEdgeMutation({
        workflowId: id,
        sourceNodeId: params.source as Id<"nodes">,
        targetNodeId: params.target as Id<"nodes">,
        sourceHandle: params.sourceHandle ?? undefined,
        targetHandle: params.targetHandle ?? undefined,
      });
    },
    [addEdgeMutation, id]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot));

      for (const change of changes) {
        if (change.type === "remove") {
          const edgeId = change.id as Id<"edges">;
          removeEdge({ edgeId });
        }
      }
    },
    [removeEdge]
  );

  const handleAddRandomNode = () => {
    addRandomNode({
      workflowId: id,
    });
  };

  const handleNodeDoubleClick = useCallback(
    (_event: MouseEvent, node: Node) => {
      navigate({
        to: "/workflows/$id",
        params: { id },
        search: (prev) => ({ ...prev, nodeId: node.id }),
      });
    },
    [navigate, id]
  );

  return (
    <ReactFlow
      edges={edges}
      fitView
      nodes={nodes}
      nodeTypes={nodeComponents}
      onConnect={onConnect}
      onEdgesChange={onEdgesChange}
      onNodeDoubleClick={handleNodeDoubleClick}
      onNodeDragStop={onNodeDragStop}
      onNodesChange={onNodesChange}
      panOnDrag={[1, 2]}
      panOnScroll
      proOptions={{
        hideAttribution: true,
      }}
      selectionMode={SelectionMode.Partial}
      selectionOnDrag
      snapToGrid
    >
      {/* <Panel position="bottom-center">
        <div className="flex gap-2">
          <Button
            onClick={() => handleAddRandomNode()}
            type="button"
            variant="secondary"
          >
            <PlusIcon />
          </Button>
          <Button
            onClick={() => clearWorflowRun({ workflowId: id })}
            type="button"
            variant="secondary"
          >
            <BrushCleaning />
          </Button>
          <Button
            className="cursor-pointer"
            onClick={() => mutation({ id })}
            type="button"
            variant="secondary"
          >
            <Play />
          </Button>
        </div>
      </Panel> */}
      <Background variant={BackgroundVariant.Dots} />
      {/* <Controls /> */}
    </ReactFlow>
  );
}

export function HttpNodeInspector() {
  const [params, setParams] = useState<HttpGetParameterValues>({
    method: "GET",
    url: "https://jsonplaceholder.typicode.com/todos/1",
  });

  const handleChange = (next: HttpGetParameterValues) => {
    setParams(next);
    // TODO: persist to Convex, update local graph state, etc.
  };

  return (
    <section aria-label="HTTP node settings">
      <h2>{httpGetNode.manifest.displayName}</h2>
      <HttpGetConfigPanel onChange={handleChange} value={params} />
    </section>
  );
}
