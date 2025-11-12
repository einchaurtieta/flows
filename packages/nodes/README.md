# @flows/nodes

Shared contracts and helpers for authoring flow nodes in one place. The package ships layered entry points so that clients only import what they need:

| Entry point | Purpose |
| --- | --- |
| `@flows/nodes` | Pure domain primitives (`defineNode`, schemas, registry helpers) |
| `@flows/nodes/client` | React helpers such as `NodeConfigPanel` |
| `@flows/nodes/server` | Convex-ready executor helpers |
| `@flows/nodes/devtools` | Authoring utilities like the definition validator |
| `@flows/nodes/examples` | Reference implementations (currently `textConstantNode`) |

## Authoring a node

1. Describe parameters and ports with Zod schemas:

```ts
const parameters = {
  message: defineParameter({
    id: "message",
    label: "Message",
    schema: z.string().min(1),
    control: "textarea",
    defaultValue: "Hello",
  }),
} as const;

const ports = {
  inputs: {},
  outputs: {
    text: definePort({
      id: "text",
      label: "Text",
      schema: z.string(),
      multiplicity: "many",
    }),
  },
} as const;
```

2. Register the manifest once:

```ts
export const textConstantNode = defineNode({
  manifest: {
    id: "text-constant",
    version: "0.1.0",
    displayName: "Constant Text",
    description: "Emits the configured string.",
    kind: "source",
  },
  parameters,
  ports,
});
```

3. Wire the client config UI by reusing `NodeConfigPanel` or creating a custom component. The panel is fully typed so value objects stay aligned with your schema.

```tsx
export const TextConstantConfigPanel = ({ value, onChange }: Props) => (
  <NodeConfigPanel definition={textConstantNode} value={value} onChange={onChange} />
);
```

4. Provide a Convex action/executor by wrapping your handler with `createNodeExecutor`. The helper validates parameters/inputs, provides typed payloads, and enforces output schemas via `emit`.

```ts
export const runTextConstantNode = createNodeExecutor({
  definition: textConstantNode,
  handler: async ({ parameters, emit }) => {
    emit("text", [parameters.message]);
  },
});
```

## Example node

`@flows/nodes/examples` currently exposes:

- `textConstantNode`: emits a configured string.
- `httpGetNode`: performs a GET request and emits status/body/headers.

Use them as templates for new nodes and as smoke tests that the shared helpers work end-to-end.

## Follow-up

- Run `npm install` (using Node 18+ / npm 9+) at the repo root to refresh the workspace lockfile so it includes the new package once your local toolchain supports it.
- Flesh out additional devtools (e.g., scaffolding CLI, automated manifest validation during CI) inside `src/devtools`.
