import type {
  NodeDefinition,
  ParameterDefinitions,
  PartialParameterValues,
  PortsDefinition,
} from "@flows/nodes";
import { httpGetNode, switchNode } from "@flows/nodes/examples";

type AnyNodeDefinition = NodeDefinition<
  ParameterDefinitions,
  PortsDefinition
>;

export const registeredNodeDefinitions = {
  http: httpGetNode,
  switch: switchNode,
} as const satisfies Record<
  string,
  AnyNodeDefinition
>;

export type RegisteredNodeType =
  keyof typeof registeredNodeDefinitions;

type DefinitionMap = typeof registeredNodeDefinitions;

export type NodeParameters<
  TType extends RegisteredNodeType,
> = PartialParameterValues<
  DefinitionMap[TType]["parameters"]
>;

export const getNodeDefinition = (
  type: string,
) =>
  (registeredNodeDefinitions as Record<
    string,
    AnyNodeDefinition | undefined
  >)[type];

export const hydrateNodeParameters = <
  TType extends RegisteredNodeType,
>(
  type: TType,
  parameters: unknown,
): NodeParameters<TType> => {
  const definition = registeredNodeDefinitions[type];
  const parsed = definition.parameterSchema.safeParse(
    parameters ?? {},
  );
  if (parsed.success) {
    return parsed.data as NodeParameters<TType>;
  }
  return {} as NodeParameters<TType>;
};

export const isRegisteredNodeType = (
  type: string,
): type is RegisteredNodeType =>
  Object.hasOwn(registeredNodeDefinitions, type);
