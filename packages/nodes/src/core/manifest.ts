import type { z } from "zod";
import {
  buildParameterSchema,
  type ParameterDefinitions,
  type ParameterShape,
} from "./parameters.js";
import {
  buildPortSchema,
  type PortShape,
  type PortsDefinition,
} from "./ports.js";

export type NodeManifest = {
  readonly id: string;
  readonly version: string;
  readonly displayName: string;
  readonly description?: string;
  readonly kind?: "source" | "transform" | "sink";
  readonly categories?: readonly string[];
  readonly icon?: string;
};

export type NodeDefinition<
  TParameters extends ParameterDefinitions,
  TPorts extends PortsDefinition,
> = {
  readonly manifest: NodeManifest;
  readonly parameters: TParameters;
  readonly ports: TPorts;
  readonly parameterSchema: z.ZodObject<ParameterShape<TParameters>>;
  readonly inputSchema: z.ZodObject<PortShape<TPorts["inputs"]>>;
};

type DefineNodeOptions<
  TParameters extends ParameterDefinitions,
  TPorts extends PortsDefinition,
> = {
  readonly manifest: NodeManifest;
  readonly parameters: TParameters;
  readonly ports: TPorts;
};

export const defineNode = <
  TParameters extends ParameterDefinitions,
  TPorts extends PortsDefinition,
>({
  manifest,
  parameters,
  ports,
}: DefineNodeOptions<TParameters, TPorts>): NodeDefinition<
  TParameters,
  TPorts
> => {
  const parameterSchema = buildParameterSchema(parameters);
  const inputSchema = buildPortSchema(
    ports.inputs,
  ) as z.ZodObject<PortShape<TPorts["inputs"]>>;
  return {
    manifest,
    parameters,
    ports,
    parameterSchema,
    inputSchema,
  };
};
