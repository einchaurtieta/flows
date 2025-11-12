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
