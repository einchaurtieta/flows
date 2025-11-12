import {
  ClientOnly,
  createFileRoute,
  ErrorComponent,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import "@xyflow/react/dist/style.css";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@flows/backend/convex/_generated/api.js";
import type { Id } from "@flows/backend/convex/_generated/dataModel.js";
import { ReactFlowProvider } from "@xyflow/react";
import { Canvas } from "./-components/canvas";

export const Route = createFileRoute("/_authenticated/workflows/$workflowId")({
  component: RouteComponent,
  errorComponent: EditorErrorComponent,
  loader: async ({ context: { queryClient }, params }) => {
    const workflowId = params.workflowId as Id<"workflows">;

    await queryClient.ensureQueryData(
      convexQuery(api.workflows.getWorflow, {
        workflowId,
      })
    );
  },
});

function EditorErrorComponent({ error }: ErrorComponentProps) {
  return <ErrorComponent error={error} />;
}

function RouteComponent() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ClientOnly fallback="loading...">
        <ReactFlowProvider>
          <Canvas />
        </ReactFlowProvider>
      </ClientOnly>
    </div>
  );
}
