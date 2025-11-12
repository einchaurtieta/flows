import { z } from "zod";

export type PortMultiplicity = "single" | "many";

type PortDefinitionBase<TSchema extends z.ZodTypeAny> = {
  readonly id: string;
  readonly label: string;
  readonly schema: TSchema;
  readonly description?: string;
  readonly required?: boolean;
  readonly capabilities?: readonly string[];
};

export type ManyPortDefinition<TSchema extends z.ZodTypeAny> =
  PortDefinitionBase<TSchema> & {
    readonly multiplicity: "many";
  };

export type SinglePortDefinition<TSchema extends z.ZodTypeAny> =
  PortDefinitionBase<TSchema> & {
    readonly multiplicity?: Exclude<PortMultiplicity, "many">;
  };

export type PortDefinition<TSchema extends z.ZodTypeAny> =
  | ManyPortDefinition<TSchema>
  | SinglePortDefinition<TSchema>;

export type PortRecord = Record<string, PortDefinition<z.ZodTypeAny>>;

export type PortsDefinition<
  TInputs extends PortRecord = PortRecord,
  TOutputs extends PortRecord = PortRecord,
> = {
  readonly inputs: TInputs;
  readonly outputs: TOutputs;
};

export type PortValue<Definition extends PortDefinition<z.ZodTypeAny>> =
  Definition extends ManyPortDefinition<z.ZodTypeAny>
    ? z.infer<Definition["schema"]>[]
    : z.infer<Definition["schema"]>;

export type PortValuesMap<Ports extends PortRecord> = {
  [K in keyof Ports]: PortValue<Ports[K]>;
};

export type NodeInputValues<Ports extends PortRecord> = Partial<
  PortValuesMap<Ports>
>;

export type NodeOutputValues<Ports extends PortRecord> = Partial<
  PortValuesMap<Ports>
>;

export type PortShape<P extends PortRecord> = Record<keyof P, z.ZodTypeAny>;

export const definePort = <TSchema extends z.ZodTypeAny>(
  definition: PortDefinition<TSchema>
) => definition;

const buildShape = <P extends PortRecord>(ports: P) => {
  const entries = Object.entries(ports) as [
    keyof P,
    PortDefinition<z.ZodTypeAny>,
  ][];
  const shape: Partial<PortShape<P>> = {};
  for (const [key, port] of entries) {
    const multiplicity = port.multiplicity ?? "single";
    const schema = multiplicity === "many" ? port.schema.array() : port.schema;
    const schemaWithOptional =
      port.required === false ? schema.optional() : schema;
    shape[key] = schemaWithOptional as z.ZodTypeAny;
  }
  return shape;
};

export const buildPortSchema = <P extends PortRecord>(ports: P) =>
  z.object(buildShape(ports) as PortShape<P>);
