import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routerWithQueryClient } from "@tanstack/react-router-with-query";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { routeTree } from "./routeTree.gen";
import "./index.css";

export function getRouter() {
  // biome-ignore lint/style/noNonNullAssertion: it's ok
  // biome-ignore lint/suspicious/noExplicitAny: relax
  const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL!;

  if (!CONVEX_URL) {
    // biome-ignore lint/suspicious/noConsole: it's ok
    console.error("missing envar VITE_CONVEX_URL");
  }

  const convex = new ConvexReactClient(CONVEX_URL, {
    unsavedChangesWarning: false,
  });

  const convexQueryClient = new ConvexQueryClient(convex);

  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  });
  convexQueryClient.connect(queryClient);

  const router = routerWithQueryClient(
    createTanStackRouter({
      routeTree,
      defaultPreload: "intent",
      defaultPendingComponent: () => <div>Loading...</div>,
      defaultNotFoundComponent: () => <div>Not Found</div>,
      context: { queryClient, convexClient: convex, convexQueryClient },
      Wrap: ({ children }) => (
        <ConvexProvider client={convexQueryClient.convexClient}>
          {children}
        </ConvexProvider>
      ),
    }),
    queryClient
  );
  return router;
}

declare module "@tanstack/react-router" {
  // biome-ignore lint/style/useConsistentTypeDefinitions: it's ok
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
