import { z } from "zod";
import { NodeConfigPanel } from "../client/index.js";
import { defineNode, defineParameter, definePort } from "../core/index.js";
import type {
  ParameterDefinitions,
  PartialParameterValues,
} from "../core/parameters.js";
import { createNodeExecutor } from "../server/index.js";

const parameters = {
  message: defineParameter({
    id: "message",
    label: "Message",
    description: "Text that will be emitted on every run.",
    schema: z.string().min(1, "Provide a message"),
    defaultValue: "Hello from @flows/nodes",
    control: "textarea",
  }),
  repeat: defineParameter({
    id: "repeat",
    label: "Repeat",
    description: "Number of times to emit the message in one run.",
    schema: z.number().int().min(1).max(5),
    defaultValue: 1,
    control: "number",
  }),
} satisfies ParameterDefinitions;

const ports = {
  inputs: {},
  outputs: {
    text: definePort({
      id: "text",
      label: "Text payload",
      description: "One or more copies of the configured message.",
      schema: z.string(),
      multiplicity: "many",
    }),
  },
};

export const textConstantNode = defineNode({
  manifest: {
    id: "text-constant",
    version: "0.1.0",
    displayName: "Constant Text",
    description: "Emits a configured string every time the node executes.",
    kind: "source",
    categories: ["demo", "text"],
  },
  parameters,
  ports,
});

export type TextConstantParameterValues = PartialParameterValues<
  typeof parameters
>;

export const TextConstantConfigPanel = ({
  value,
  onChange,
}: {
  readonly value: TextConstantParameterValues;
  readonly onChange: (value: TextConstantParameterValues) => void;
}) => (
  <NodeConfigPanel
    definition={textConstantNode}
    onChange={onChange}
    value={value}
  />
);

type ExampleActionCtx = Record<string, never>;

export const runTextConstantNode = createNodeExecutor<
  typeof textConstantNode,
  ExampleActionCtx
>({
  definition: textConstantNode,
  handler: ({ parameters: params, emit }) => {
    const messages: string[] = [];
    let remaining = params.repeat;

    while (remaining > 0) {
      messages.push(params.message);
      remaining -= 1;
    }

    emit("text", messages);
  },
});
