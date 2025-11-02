import { ClerkProvider } from "@clerk/tanstack-react-start";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import type { ConvexReactClient } from "convex/react";
import appCss from "../index.css?url";

export type RouterAppContext = {
  queryClient: QueryClient;
  convexClient: ConvexReactClient;
  convexQueryClient: ConvexQueryClient;
};

export const Route = createRootRouteWithContext<RouterAppContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Flows",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  const isFetching = useRouterState({ select: (s) => s.isLoading });

  return (
    <ClerkProvider>
      <html className="light" lang="en">
        <head>
          <HeadContent />
        </head>
        <body>
          <div className="flex">
            {isFetching ? <div>Loading...</div> : <Outlet />}
          </div>
          {/* <TanStackRouterDevtools position="bottom-left" /> */}
          <Scripts />
        </body>
      </html>
    </ClerkProvider>
  );
}
