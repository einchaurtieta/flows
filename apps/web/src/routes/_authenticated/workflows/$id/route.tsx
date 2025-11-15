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
import { z } from "zod";
import { Canvas } from "./-components/canvas";
import { Connector } from "./-components/connector";

const searchSchema = z.object({
  nodeId: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/workflows/$id")({
  component: RouteComponent,
  errorComponent: EditorErrorComponent,
  loader: async ({ context: { queryClient }, params }) => {
    await queryClient.ensureQueryData(
      convexQuery(api.workflows.getWorflow, {
        workflowId: params.id as Id<"workflows">,
      })
    );
  },
  validateSearch: searchSchema,
});

function EditorErrorComponent({ error }: ErrorComponentProps) {
  return <ErrorComponent error={error} />;
}

function RouteComponent() {
  // const navigate = useNavigate();
  // const { workflowId } = Route.useParams() as { workflowId: Id<"workflows"> };
  // const { nodeId } = Route.useSearch();

  // const closeModal = useCallback(() => {
  //   navigate({
  //     to: "/workflows/$workflowId",
  //     params: { workflowId },
  //     search: (prev) => ({ ...prev, nodeId: undefined }),
  //     replace: true,
  //   });
  // }, [navigate, workflowId]);

  return (
    <div className="relative h-screen w-screen">
      <ClientOnly fallback="loading...">
        <ReactFlowProvider>
          <Canvas />
        </ReactFlowProvider>
        <Connector />
      </ClientOnly>
    </div>
  );
}
