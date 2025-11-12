import { z } from "zod";

export type ParameterControl =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "json";

export type ParameterOption = {
  readonly label: string;
  readonly value: string;
};

export type ParameterDefinition<TSchema extends z.ZodTypeAny> = {
  readonly id: string;
  readonly label: string;
  readonly schema: TSchema;
  readonly description?: string;
  readonly defaultValue?: z.infer<TSchema>;
  readonly required?: boolean;
  readonly control?: ParameterControl;
  readonly options?: readonly ParameterOption[];
};

export type ParameterDefinitions = Record<
  string,
  ParameterDefinition<z.ZodTypeAny>
>;

export type ParameterShape<P extends ParameterDefinitions> = {
  [K in keyof P]: P[K]["schema"];
};

export type ParameterValues<P extends ParameterDefinitions> = {
  [K in keyof P]: z.infer<P[K]["schema"]>;
};

export type PartialParameterValues<P extends ParameterDefinitions> = Partial<
  ParameterValues<P>
>;

export const defineParameter = <TSchema extends z.ZodTypeAny>(
  definition: ParameterDefinition<TSchema>,
) => definition;

type DefinedValue<Schema extends z.ZodTypeAny> = Exclude<z.infer<Schema>, undefined>;

const withOptionals = <Schema extends z.ZodTypeAny>(
  schema: Schema,
  defaultValue: z.infer<Schema> | undefined,
  required: boolean | undefined,
) => {
  let schemaWithMeta: z.ZodTypeAny = schema;
  if (defaultValue !== undefined) {
    schemaWithMeta = schemaWithMeta.default(defaultValue as DefinedValue<Schema>);
  }
  if (required === false) {
    schemaWithMeta = schemaWithMeta.optional();
  }
  return schemaWithMeta;
};

export const buildParameterSchema = <P extends ParameterDefinitions>(
  definitions: P
) => {
  const entries = Object.entries(definitions) as [
    keyof P,
    ParameterDefinition<z.ZodTypeAny>,
  ][];
  const shape: Partial<ParameterShape<P>> = {};
  for (const [key, parameter] of entries) {
    const schemaWithMeta = withOptionals(
      parameter.schema,
      parameter.defaultValue,
      parameter.required
    );
    shape[key] = schemaWithMeta as ParameterShape<P>[typeof key];
  }
  return z.object(shape as ParameterShape<P>);
};
