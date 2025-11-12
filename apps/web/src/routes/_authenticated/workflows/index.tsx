import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/workflows/")({
  component: WorkflowsRoute,
});

function WorkflowsRoute() {
  return <div />;
}
