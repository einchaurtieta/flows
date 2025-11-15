/** biome-ignore-all lint/nursery/noUselessUndefined: chill */
import { z } from "zod";
import { NodeConfigPanel } from "../client/index.js";
import { defineNode, defineParameter, definePort } from "../core/index.js";
import type {
  ParameterDefinitions,
  PartialParameterValues,
} from "../core/parameters.js";
import { createNodeExecutor } from "../server/index.js";

const comparisonSchema = z.enum([
  "equals",
  "notEquals",
  "greaterThan",
  "lessThan",
  "exists",
  "notExists",
]);

const comparisonOptions: ReadonlyArray<{
  readonly label: string;
  readonly value: z.infer<typeof comparisonSchema>;
}> = [
  { label: "Equals", value: "equals" },
  { label: "Not equals", value: "notEquals" },
  { label: "Greater than", value: "greaterThan" },
  { label: "Less than", value: "lessThan" },
  { label: "Exists", value: "exists" },
  { label: "Not exists", value: "notExists" },
];

const routeSchema = z.enum(["match", "default"]);

const valueTypeSchema = z.enum(["string", "number", "boolean"]);
type ValueType = z.infer<typeof valueTypeSchema>;

const parameters = {
  path: defineParameter({
    id: "path",
    label: "Context path",
    description: "Dot-notation path to inspect within the incoming context.",
    schema: z.string().min(1, "Provide a context path"),
    control: "text",
  }),
  operator: defineParameter({
    id: "operator",
    label: "Operator",
    description: "How to compare the resolved value against the expected one.",
    schema: comparisonSchema,
    defaultValue: "equals",
    control: "select",
    options: comparisonOptions,
  }),
  valueType: defineParameter({
    id: "valueType",
    label: "Value type",
    description: "How to coerce the context value and the expected value.",
    schema: valueTypeSchema,
    defaultValue: "string",
    control: "select",
    options: [
      { label: "String", value: "string" },
      { label: "Number", value: "number" },
      { label: "Boolean", value: "boolean" },
    ],
  }),
  expectedValue: defineParameter({
    id: "expectedValue",
    label: "Expected value",
    description: "Literal to compare against when the operator needs it.",
    schema: z.string().optional(),
    control: "text",
  }),
  missingRoute: defineParameter({
    id: "missingRoute",
    label: "Missing value route",
    description: "Route to follow if the context path resolves to nothing.",
    schema: routeSchema,
    defaultValue: "default",
    control: "select",
    options: [
      { label: "Match", value: "match" },
      { label: "Default", value: "default" },
    ],
  }),
} satisfies ParameterDefinitions;

const ports = {
  inputs: {},
  outputs: {
    route: definePort({
      id: "route",
      label: "Selected route",
      description: "Route selected after evaluating the condition.",
      schema: routeSchema,
    }),
    matched: definePort({
      id: "matched",
      label: "Matched",
      description: "Whether the evaluated condition returned true.",
      schema: z.boolean(),
    }),
    value: definePort({
      id: "value",
      label: "Resolved value",
      description: "Value read from the provided context path.",
      schema: z.unknown(),
    }),
  },
};

export const switchNode = defineNode({
  manifest: {
    id: "switch",
    version: "0.1.0",
    displayName: "Switch",
    description:
      "Evaluates a condition and routes execution through Match/Default outputs.",
    kind: "transform",
    categories: ["control"],
    icon: "git-branch",
  },
  parameters,
  ports,
});

export type SwitchParameterValues = PartialParameterValues<typeof parameters>;

export const SwitchConfigPanel = ({
  value,
  onChange,
}: {
  readonly value: SwitchParameterValues;
  readonly onChange: (value: SwitchParameterValues) => void;
}) => (
  <NodeConfigPanel definition={switchNode} onChange={onChange} value={value} />
);

type SwitchExecutorContext = {
  readonly context: Record<string, unknown>;
};

const segmentDelimiter = ".";

const resolvePathValue = (data: Record<string, unknown>, path: string) => {
  const trimmedPath = path.trim();
  if (trimmedPath.length === 0) {
    return undefined;
  }
  const segments = trimmedPath
    .split(segmentDelimiter)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  let current: unknown = data;
  for (const segment of segments) {
    if (
      current === null ||
      typeof current !== "object" ||
      Array.isArray(current)
    ) {
      return undefined;
    }
    const record = current as Record<string, unknown>;
    if (!Object.hasOwn(record, segment)) {
      return undefined;
    }
    const next = record[segment];
    current = next;
  }
  return current;
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: chill
const coerceValue = (value: unknown, valueType: ValueType) => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (valueType === "number") {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return undefined;
    }
    return numeric;
  }
  if (valueType === "boolean") {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      const lowered = value.toLowerCase();
      if (lowered === "true") {
        return true;
      }
      if (lowered === "false") {
        return false;
      }
    }
    if (typeof value === "number") {
      if (value === 1) {
        return true;
      }
      if (value === 0) {
        return false;
      }
    }
    return undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  return String(value);
};

const requiresExpectedValue = (operator: z.infer<typeof comparisonSchema>) =>
  operator !== "exists" && operator !== "notExists";

const evaluateComparison = ({
  left,
  right,
  operator,
}: {
  readonly left: unknown;
  readonly right: unknown;
  readonly operator: z.infer<typeof comparisonSchema>;
}) => {
  if (operator === "exists") {
    return left !== undefined && left !== null;
  }
  if (operator === "notExists") {
    return left === undefined || left === null;
  }

  if (left === undefined || right === undefined) {
    return false;
  }

  if (operator === "equals") {
    return left === right;
  }
  if (operator === "notEquals") {
    return left !== right;
  }

  if (typeof left !== "number" || typeof right !== "number") {
    return false;
  }

  if (operator === "greaterThan") {
    return left > right;
  }
  if (operator === "lessThan") {
    return left < right;
  }

  return false;
};

export const runSwitchNode = createNodeExecutor<
  typeof switchNode,
  SwitchExecutorContext
>({
  definition: switchNode,
  handler: ({ parameters: params, ctx, emit }) => {
    const contextData = ctx.context ?? {};
    const rawValue = resolvePathValue(contextData, params.path);
    const coercedActual = coerceValue(rawValue, params.valueType);
    const expected =
      params.expectedValue === undefined
        ? undefined
        : coerceValue(params.expectedValue, params.valueType);

    const canCompare =
      !requiresExpectedValue(params.operator) || expected !== undefined;
    const matched = canCompare
      ? evaluateComparison({
          left: coercedActual,
          right: expected,
          operator: params.operator,
        })
      : false;

    const shouldUseMissingRoute =
      rawValue === undefined &&
      params.operator !== "exists" &&
      params.operator !== "notExists";

    let route: z.infer<typeof routeSchema>;
    if (shouldUseMissingRoute) {
      route = params.missingRoute;
    } else if (matched) {
      route = "match";
    } else {
      route = "default";
    }

    emit("route", route);
    emit("matched", matched);
    emit("value", rawValue ?? null);
  },
});
