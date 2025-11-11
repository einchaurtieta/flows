import {
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
  useReactFlow,
} from "@xyflow/react";
import { useCallback, useEffect } from "react";
import "@xyflow/react/dist/style.css";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@flows/backend/convex/_generated/api.js";
import type { Id } from "@flows/backend/convex/_generated/dataModel.js";
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

  const reactFlowInstance = useReactFlow();

  const mutation = useConvexMutation(api.workflows.fireWorkflowProcess);
  const updatePosition = useConvexMutation(api.workflows.updateNodePosition);
  const removeEdge = useConvexMutation(api.workflows.removeEdge);
  const addEdgeMutation = useConvexMutation(api.workflows.addEdge);
  const removeNode = useConvexMutation(api.workflows.removeNode);
  const addRandomNode = useConvexMutation(api.workflows.createRandomNode);

  const formattedWorkflowNodes = workflow?.nodes.map((node) => ({
    id: node._id as string,
    type: node.type,
    position: node.position as { x: number; y: number },
    data: {
      name: node.name,
    },
  })) as Node[];

  const formattedEdges = workflow?.edges.map((edge) => ({
    id: edge._id as string,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
  })) as Edge[];

  // biome-ignore lint/correctness/useExhaustiveDependencies: chill
  useEffect(() => {
    if (!steps) {
      return;
    }

    const updatedNodes = formattedWorkflowNodes.map((node) => {
      const step = steps.find((_step) => _step.nodeId === node.id);

      if (step) {
        return {
          ...node,
          data: {
            ...node.data,
            status: step.status,
            result: step.result,
          },
        };
      }
      return node;
    });

    const updateEdges = formattedEdges.map((edge) => {
      const sourceNodeStep = steps.find(
        (_step) => _step.nodeId === edge.source
      );
      const targetNodeStep = steps.find(
        (_step) => _step.nodeId === edge.target
      );

      if (
        sourceNodeStep &&
        targetNodeStep &&
        targetNodeStep.status === "running"
      ) {
        return {
          ...edge,
          animated: true,
          // style: { stroke: "lightgreen" },
        };
      }

      return {
        ...edge,
        animated: false,
        // style: { stroke: "lightgrey" },
      };
    });

    reactFlowInstance.setEdges(updateEdges);
    reactFlowInstance.setNodes(updatedNodes);
  }, [steps]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === "position") {
          updatePosition({
            nodeId: change.id as Id<"nodes">,
            positionX: change.position?.x || 0,
            positionY: change.position?.y || 0,
          });
        }

        if (change.type === "remove") {
          const nodeId = change.id as Id<"nodes">;
          removeNode({ nodeId });
        }

        // if (change.type === "add") {
        //   console.log("Node added:", change);
        // }
      }

      // return setNodes((nodesSnapshot) =>
      //   applyNodeChanges(changes, nodesSnapshot)
      // );
    },
    [updatePosition, removeNode]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const change of changes) {
        if (change.type === "remove") {
          const edgeId = change.id as Id<"edges">;
          removeEdge({ edgeId });
        }
      }

      // return setEdges((edgesSnapshot) =>
      //   applyEdgeChanges(changes, edgesSnapshot)
      // );
    },
    [removeEdge]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      addEdgeMutation({
        workflowId: "jh764q8p3p7sa56e23zjw58vt57tp4gn" as Id<"workflows">,
        sourceNodeId: params.source as Id<"nodes">,
        targetNodeId: params.target as Id<"nodes">,
      });
      // return setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot));
    },
    [addEdgeMutation]
  );

  function handleAddRandomNode() {
    addRandomNode({
      workflowId: "jh764q8p3p7sa56e23zjw58vt57tp4gn" as Id<"workflows">,
    });
  }

  return (
    <ReactFlow
      defaultEdges={formattedEdges}
      defaultNodes={formattedWorkflowNodes}
      fitView
      nodeTypes={nodeComponents}
      onConnect={onConnect}
      onEdgesChange={onEdgesChange}
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
