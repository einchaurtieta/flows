import type { NodeDefinition } from "./manifest.js";
import type { ParameterDefinitions } from "./parameters.js";
import type { PortsDefinition } from "./ports.js";

type AnyNodeDefinition = NodeDefinition<ParameterDefinitions, PortsDefinition>;

export type NodeRegistry = {
  readonly register: (definition: AnyNodeDefinition) => void;
  readonly findById: (id: string) => AnyNodeDefinition | undefined;
  readonly list: () => AnyNodeDefinition[];
};

export const createNodeRegistry = (): NodeRegistry => {
  const definitions = new Map<string, AnyNodeDefinition>();
  const register = (definition: AnyNodeDefinition) => {
    definitions.set(definition.manifest.id, definition);
  };
  const findById = (id: string) => definitions.get(id);
  const list = () => Array.from(definitions.values());
  return { register, findById, list };
};
