import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
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
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Clock,
  Globe,
  Loader2,
  Plus,
  PlusIcon,
} from "lucide-react";
import { WorkflowNode } from "@/components/node";
import { PlaceholderNode } from "@/components/placeholder-node";
import { TriggerNode } from "@/components/trigger-node";
import { Button } from "@/components/ui/button";

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
    const nodeId = useNodeId();
    const data = useNodesData(nodeId ?? "");

    return (
      <WorkflowNode>
        {data?.data.status === "running" ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Clock />
        )}
      </WorkflowNode>
    );
  },
  http: () => {
    const nodeId = useNodeId();
    const data = useNodesData(nodeId ?? "");

    return (
      <WorkflowNode>
        {data?.data.status === "running" ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Globe />
        )}
      </WorkflowNode>
    );
  },
} as const satisfies NodeTypes;

type Step = {
  nodeId: string;
  status: string;
};

function isEdgeAnimated(edge: Doc<"edges">, steps: Step[]) {
  const sourceNodeStep = steps.find(
    (step) => step.nodeId === edge.sourceNodeId
  );
  const targetNodeStep = steps.find(
    (step) => step.nodeId === edge.targetNodeId
  );

  return (
    sourceNodeStep && targetNodeStep && targetNodeStep.status === "running"
  );
}

export function Canvas() {
  const { data: workflow } = useSuspenseQuery(
    convexQuery(api.workflows.getWorflow, {
      workflowId: "jh764q8p3p7sa56e23zjw58vt57tp4gn" as Id<"workflows">,
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

  const formattedWorkflowNodes = useMemo(
    () =>
      workflow?.nodes.map((node) => ({
        id: node._id as string,
        data: {
          label: node.name,
          status: steps?.find((_step) => _step.nodeId === node._id)?.status,
        },
        position: {
          x: node.position.x,
          y: node.position.y,
        },
        type: node.type,
      })) as Node[],
    [workflow?.nodes, steps]
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
    // keep selection while rebasing from server
    setNodes((prev) => {
      const prevById = new Map(prev.map((n) => [n.id, n]));

      return (formattedWorkflowNodes || []).map((n) => {
        const p = prevById.get(n.id);
        return p ? { ...n, selected: p.selected } : n;
      });
    });
  }, [formattedWorkflowNodes]);

  useEffect(() => {
    // keep selection while rebasing from server
    setEdges((prev) => {
      const prevById = new Map(prev.map((e) => [e.id, e]));

      return (formattedEdges || []).map((e) => {
        const p = prevById.get(e.id);
        return p ? { ...e, selected: p.selected } : e;
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
        workflowId: "jh764q8p3p7sa56e23zjw58vt57tp4gn" as Id<"workflows">,
        sourceNodeId: params.source as Id<"nodes">,
        targetNodeId: params.target as Id<"nodes">,
      });
    },
    [addEdgeMutation]
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
      workflowId: "jh764q8p3p7sa56e23zjw58vt57tp4gn" as Id<"workflows">,
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
      <Panel position="top-right">
        <div className="flex gap-2">
          <Button
            onClick={() => handleAddRandomNode()}
            type="button"
            variant="secondary"
          >
            <PlusIcon />
          </Button>
          <Button
            onClick={() =>
              mutation({
                id: "jh764q8p3p7sa56e23zjw58vt57tp4gn" as Id<"workflows">,
              })
            }
            type="button"
            variant="secondary"
          >
            Run workflow
          </Button>
        </div>
      </Panel>
      <Background />
      <Controls />
    </ReactFlow>
  );
}
