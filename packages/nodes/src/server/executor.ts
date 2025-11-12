import type { NodeDefinition } from "../core/manifest.js";
import type {
  ParameterDefinitions,
  ParameterValues,
  PartialParameterValues,
} from "../core/parameters.js";
import type {
  NodeInputValues,
  NodeOutputValues,
  PortRecord,
  PortsDefinition,
  PortValue,
} from "../core/ports.js";

type PortKey<Ports extends PortRecord> = Extract<keyof Ports, string>;

type AnyNodeDefinition = NodeDefinition<ParameterDefinitions, PortsDefinition>;
type DefaultCtx = Record<string, never>;

export type NodeExecutionResult<Outputs extends PortRecord> = NodeOutputValues<Outputs>;

type NodeEmit<Outputs extends PortRecord> = <Key extends PortKey<Outputs>>(
  portId: Key,
  payload: PortValue<Outputs[Key]>,
) => void;

export type NodeExecutionContext<
  Definition extends AnyNodeDefinition,
  TActionCtx = DefaultCtx,
> = {
  readonly ctx: TActionCtx;
  readonly definition: Definition;
  readonly parameters: ParameterValues<Definition["parameters"]>;
  readonly inputs: NodeInputValues<Definition["ports"]["inputs"]>;
  readonly emit: NodeEmit<Definition["ports"]["outputs"]>;
};

export type NodeExecutorHandler<
  Definition extends AnyNodeDefinition,
  TActionCtx = DefaultCtx,
> = (
  context: NodeExecutionContext<Definition, TActionCtx>
) => Promise<void> | void;

export type NodeExecutor<
  Definition extends AnyNodeDefinition,
  TActionCtx = DefaultCtx,
> = (options: {
  readonly ctx: TActionCtx;
  readonly parameters?: PartialParameterValues<Definition["parameters"]>;
  readonly inputs?: NodeInputValues<Definition["ports"]["inputs"]>;
}) => Promise<NodeExecutionResult<Definition["ports"]["outputs"]>>;

type CreateNodeExecutorOptions<
  Definition extends AnyNodeDefinition,
  TActionCtx = DefaultCtx,
> = {
  readonly definition: Definition;
  readonly handler: NodeExecutorHandler<Definition, TActionCtx>;
};

export const createNodeExecutor = <
  Definition extends AnyNodeDefinition,
  TActionCtx = DefaultCtx,
>({
  definition,
  handler,
}: CreateNodeExecutorOptions<Definition, TActionCtx>): NodeExecutor<
  Definition,
  TActionCtx
> => {
  const executor: NodeExecutor<Definition, TActionCtx> = async ({
    ctx,
    parameters,
    inputs,
  }) => {
    const safeParameters = definition.parameterSchema.parse(
      parameters ?? ({} as PartialParameterValues<Definition["parameters"]>)
    ) as ParameterValues<Definition["parameters"]>;
    const safeInputs = definition.inputSchema.parse(
      inputs ?? ({} as NodeInputValues<Definition["ports"]["inputs"]>)
    ) as NodeInputValues<Definition["ports"]["inputs"]>;
    const emitted: Partial<
      NodeExecutionResult<Definition["ports"]["outputs"]>
    > = {};
    const emit: NodeEmit<Definition["ports"]["outputs"]> = (
      portId,
      payload
    ) => {
      const portDefinition = definition.ports.outputs[portId];
      if (!portDefinition) {
        throw new Error(
          `Unknown output port "${String(portId)}" on node ${definition.manifest.id}`
        );
      }
      const multiplicity = portDefinition.multiplicity ?? "single";
      const schema =
        multiplicity === "many"
          ? portDefinition.schema.array()
          : portDefinition.schema;
      const validated = schema.parse(payload);
      emitted[portId] = validated as NodeExecutionResult<
        Definition["ports"]["outputs"]
      >[typeof portId];
    };

    await handler({
      ctx,
      definition,
      parameters: safeParameters,
      inputs: safeInputs,
      emit,
    });
    return emitted as NodeExecutionResult<Definition["ports"]["outputs"]>;
  };

  return executor;
};
