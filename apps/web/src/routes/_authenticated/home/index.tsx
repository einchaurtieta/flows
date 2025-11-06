import {
  ClientOnly,
  createFileRoute,
  ErrorComponent,
  type ErrorComponentProps,
} from "@tanstack/react-router";
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
  ReactFlowProvider,
  useNodeId,
  useNodesData,
} from "@xyflow/react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import "@xyflow/react/dist/style.css";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@flows/backend/convex/_generated/api.js";
import type { Id } from "@flows/backend/convex/_generated/dataModel.js";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Globe, Plus } from "lucide-react";
import { PlaceholderNode } from "@/components/placeholder-node";
import { Button } from "@/components/ui/button";

type WorkflowStepStatus = {
  nodeId: string | null;
  stepNumber: number;
  name: string;
  result: "success" | "failed" | "canceled" | null;
  startedAt: number | null;
  completedAt: number | null;
  data: unknown;
  status: string;
};

type WorkflowStepsContextValue = {
  steps: WorkflowStepStatus[] | undefined;
};

const WorkflowStepsContext = createContext<WorkflowStepsContextValue | null>(
  null
);

type WorkflowStepsProviderProps = {
  children: ReactNode;
  steps: WorkflowStepStatus[] | undefined;
};

const WorkflowStepsProvider = ({
  children,
  steps,
}: WorkflowStepsProviderProps) => {
  const value = useMemo(
    () => ({
      steps,
    }),
    [steps]
  );

  return (
    <WorkflowStepsContext.Provider value={value}>
      {children}
    </WorkflowStepsContext.Provider>
  );
};

export const useWorkflowSteps = () => {
  const context = useContext(WorkflowStepsContext);
  if (!context) {
    throw new Error(
      "useWorkflowSteps must be used within WorkflowStepsProvider"
    );
  }
  return context;
};

export const Route = createFileRoute("/_authenticated/home/")({
  component: RouteComponent,
  errorComponent: EditorErrorComponent,
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(
      convexQuery(api.workflows.getWorflow, {
        workflowId: "jh764q8p3p7sa56e23zjw58vt57tp4gn" as Id<"workflows">,
      })
    );
  },
});

const nodeComponents = {
  initial: () => (
    <PlaceholderNode>
      <div className="flex items-center justify-center">
        <Plus />
      </div>
    </PlaceholderNode>
  ),
  trigger: () => (
    <PlaceholderNode>
      <ArrowRight />
    </PlaceholderNode>
  ),
  http: () => {
    const nodeId = useNodeId();
    const data = useNodesData(nodeId ?? "");

    return (
      <PlaceholderNode>
        {data?.data.status === "running" ? "Running..." : <Globe />}
      </PlaceholderNode>
    );
  },
} as const satisfies NodeTypes;

export function EditorErrorComponent({ error }: ErrorComponentProps) {
  return <ErrorComponent error={error} />;
}

function RouteComponent() {
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

  const mutation = useConvexMutation(api.workflows.kickoffWorkflow);
  const updatePosition = useConvexMutation(api.workflows.updateNodePosition);

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

  const [nodes, setNodes] = useState<Node[]>(formattedWorkflowNodes);
  const [edges, setEdges] = useState<Edge[]>(formattedEdges);

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
          // style: { stroke: "blue" },
        };
      }

      return {
        ...edge,
        animated: false,
        // style: { stroke: "lightgrey" },
      };
    });

    setEdges(updateEdges);

    setNodes(updatedNodes);
  }, [steps]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (changes[0].type === "position") {
        updatePosition({
          nodeId: changes[0].id as Id<"nodes">,
          positionX: changes[0].position?.x || 0,
          positionY: changes[0].position?.y || 0,
        });
      }

      return setNodes((nodesSnapshot) =>
        applyNodeChanges(changes, nodesSnapshot)
      );
    },
    [updatePosition]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    []
  );

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
    []
  );

  return (
    <WorkflowStepsProvider steps={steps}>
      <div style={{ width: "100vw", height: "100vh" }}>
        <ClientOnly fallback="loading...">
          <ReactFlowProvider>
            <ReactFlow
              edges={edges}
              fitView
              nodes={nodes}
              nodeTypes={nodeComponents}
              onConnect={onConnect}
              onEdgesChange={onEdgesChange}
              onNodesChange={onNodesChange}
              proOptions={{
                hideAttribution: true,
              }}
            >
              <Panel position="top-right">
                <Button
                  onClick={() => mutation()}
                  type="button"
                  variant="secondary"
                >
                  Run workflow
                </Button>
              </Panel>
              <Background />
              <Controls />
            </ReactFlow>
          </ReactFlowProvider>
        </ClientOnly>
      </div>
    </WorkflowStepsProvider>
  );
}
