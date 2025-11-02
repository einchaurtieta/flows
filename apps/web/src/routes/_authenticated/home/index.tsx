import { createFileRoute } from "@tanstack/react-router";
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
  ReactFlow,
} from "@xyflow/react";
import { useCallback, useState } from "react";
import "@xyflow/react/dist/style.css";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@flows/backend";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PlaceholderNode } from "@/components/placeholder-node";

export const Route = createFileRoute("/_authenticated/home/")({
  component: RouteComponent,
  loader({ context: { queryClient } }) {
    queryClient.ensureQueryData(
      convexQuery(api.workflows.getWorflow, {
        workflowId: "jh7f8dgg96st1bpj0eycw9zrt17tnbbj",
      })
    );
  },
});

// const initialNodes = [
//   { id: "n1", position: { x: 0, y: 0 }, data: { label: "Node 1" } },
//   { id: "n2", position: { x: 0, y: 100 }, data: { label: "Node 2" } },
// ];

// const initialEdges = [{ id: "n1-n2", source: "n1", target: "n2" }];

const nodeComponents = {
  initial: () => (
    <PlaceholderNode>
      <div>+</div>
    </PlaceholderNode>
  ),
} as const satisfies NodeTypes;

function RouteComponent() {
  const { data } = useSuspenseQuery(
    convexQuery(api.workflows.getWorflow, {
      workflowId: "jh7f8dgg96st1bpj0eycw9zrt17tnbbj",
    })
  );

  const formattedWorkflowNodes = data?.workflow.nodes.map((node) => ({
    id: node._id as string,
    type: node.type,
    position: node.position as { x: number; y: number },
    data: {
      name: node.name,
    },
  })) as Node[];

  const [nodes, setNodes] = useState<Node[]>(formattedWorkflowNodes);
  const [edges, setEdges] = useState<Edge[]>([]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    []
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
    <div style={{ width: "100vw", height: "100vh" }}>
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
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
