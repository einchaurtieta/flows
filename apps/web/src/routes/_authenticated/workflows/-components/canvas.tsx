import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeTypes,
  Panel,
  ReactFlow,
  SelectionMode,
  useNodeId,
  useNodesData,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  ArrowRight,
  BrushCleaning,
  Check,
  Clock,
  Globe,
  Loader2,
  Play,
  Plus,
  PlusIcon,
  X,
} from "lucide-react";
import { WorkflowNode } from "@/components/node";
import { PlaceholderNode } from "@/components/placeholder-node";
import { TriggerNode } from "@/components/trigger-node";
import { Button } from "@/components/ui/button";
import { Route } from "../$workflowId";

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
      <ArrowRight />
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
          <Loader2 className="animate-spin" />
        ) : (
          <Clock />
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
          <Loader2 className="animate-spin" />
        ) : (
          <Globe />
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
} as const satisfies NodeTypes;

type Step = {
  nodeId: string;
  result: "success" | "failed" | "canceled" | null | undefined;
  inProgress: boolean;
  data: any;
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
  const { workflowId } = Route.useParams() as { workflowId: Id<"workflows"> };

  const { data: workflow } = useSuspenseQuery(
    convexQuery(api.workflows.getWorflow, {
      workflowId,
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

  const formattedWorkflowNodes = useMemo(
    () =>
      workflow?.nodes.map((node) => ({
        id: node._id as string,
        data: {
          label: node.name,
          inProgress: steps?.find((_step) => _step.nodeId === node._id)
            ?.inProgress,
          isConnected: workflow.edges.some(
            (edge) => edge.sourceNodeId === node._id
          ),
          result: steps?.find((_step) => _step.nodeId === node._id)?.data,
        },
        position: {
          x: node.position.x,
          y: node.position.y,
        },
        type: node.type,
      })) as Node[],
    [workflow?.nodes, steps, workflow?.edges]
  );

  const formattedEdges = useMemo(
    () =>
      workflow?.edges.map((edge) => ({
        id: edge._id as string,
        source: edge.sourceNodeId,
        target: edge.targetNodeId,
        animated: isEdgeAnimated(edge, steps || []),
      })) as Edge[],
    [workflow?.edges, steps]
  );

  const [nodes, setNodes] = useState<Node[]>(formattedWorkflowNodes || []);
  const [edges, setEdges] = useState<Edge[]>(formattedEdges || []);

  useEffect(() => {
    setNodes((prev) => {
      const prevById = new Map(prev.map((node) => [node.id, node]));

      return (formattedWorkflowNodes || []).map((node) => {
        const prevNode = prevById.get(node.id);
        return prevNode ? { ...node, selected: prevNode.selected } : node;
      });
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
        workflowId,
        sourceNodeId: params.source as Id<"nodes">,
        targetNodeId: params.target as Id<"nodes">,
      });
    },
    [addEdgeMutation, workflowId]
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
      workflowId,
    });
  };

  return (
    <ReactFlow
      edges={edges}
      fitView
      nodes={nodes}
      nodeTypes={nodeComponents}
      onConnect={onConnect}
      onEdgesChange={onEdgesChange}
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
      <Panel position="bottom-center">
        <div className="flex gap-2">
          <Button
            onClick={() => handleAddRandomNode()}
            type="button"
            variant="secondary"
          >
            <PlusIcon />
          </Button>
          <Button
            onClick={() => clearWorflowRun({ workflowId })}
            type="button"
            variant="secondary"
          >
            <BrushCleaning />
          </Button>
          <Button
            className="cursor-pointer"
            onClick={() => mutation({ id: workflowId })}
            type="button"
            variant="secondary"
          >
            <Play />
          </Button>
          {/* <HttpNodeInspector /> */}
        </div>
      </Panel>
      <Background variant={BackgroundVariant.Dots} />
      <Controls />
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
