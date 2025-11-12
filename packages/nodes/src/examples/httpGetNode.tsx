import { z } from "zod/v4";
import { NodeConfigPanel } from "../client";
import { defineNode, defineParameter, definePort } from "../core";
import type {
  ParameterDefinitions,
  PartialParameterValues,
} from "../core/parameters.js";
import { createNodeExecutor } from "../server";

const parameters = {
  method: defineParameter({
    id: "method",
    label: "HTTP Method",
    description: "HTTP method to use for the request.",
    schema: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]),
    defaultValue: "GET",
    control: "select",
    options: [
      { label: "GET", value: "GET" },
      { label: "POST", value: "POST" },
      { label: "PUT", value: "PUT" },
      { label: "DELETE", value: "DELETE" },
      { label: "PATCH", value: "PATCH" },
    ],
  }),
  url: defineParameter({
    id: "url",
    label: "Request URL",
    description: "Public HTTP endpoint to call with GET.",
    schema: z.url("Provide a valid absolute URL"),
    defaultValue: "https://jsonplaceholder.typicode.com/todos/1",
    control: "text",
  }),
  body: defineParameter({
    id: "body",
    label: "Request Body",
    description: "Body to include in the request",
    schema: z.json("Provide a valid JSON value").optional(),
    control: "textarea",
  }),
} satisfies ParameterDefinitions;

const ports = {
  inputs: {},
  outputs: {
    status: definePort({
      id: "status",
      label: "Status Code",
      description: "HTTP status returned by the remote server.",
      schema: z.number().int().nonnegative(),
    }),
    body: definePort({
      id: "body",
      label: "Body",
      description: "Raw response body as a UTF-8 string.",
      schema: z.string(),
    }),
    headers: definePort({
      id: "headers",
      label: "Headers",
      description: "Normalized response headers.",
      schema: z.record(z.string(), z.string()),
    }),
  },
};

export const httpGetNode = defineNode({
  manifest: {
    id: "http-get",
    version: "0.1.0",
    displayName: "HTTP GET",
    description: "Fetch data from any HTTPS endpoint using GET.",
    kind: "source",
    categories: ["network", "http"],
    icon: "globe",
  },
  parameters,
  ports,
});

export type HttpGetParameterValues = PartialParameterValues<typeof parameters>;

export const HttpGetConfigPanel = ({
  value,
  onChange,
}: {
  readonly value: HttpGetParameterValues;
  readonly onChange: (value: HttpGetParameterValues) => void;
}) => (
  <NodeConfigPanel definition={httpGetNode} onChange={onChange} value={value} />
);

type HttpExecutorContext = {
  readonly fetch?: typeof fetch;
};

const toHeaderRecord = (headers: Headers): Record<string, string> => {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
};

export const runHttpGetNode = createNodeExecutor<
  typeof httpGetNode,
  HttpExecutorContext
>({
  definition: httpGetNode,
  handler: async ({ parameters: params, emit, ctx }) => {
    throw new Error("Not implemented yet");
    const fetchImpl = ctx.fetch ?? fetch;

    const response = await fetchImpl(params.url, {
      method: params.method,
      body: params.body?.toString(),
    });

    const body = await response.text();

    emit("status", response.status);
    emit("body", body);
    emit("headers", toHeaderRecord(response.headers));
  },
});
