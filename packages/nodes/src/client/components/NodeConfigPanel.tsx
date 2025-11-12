import type { ChangeEvent } from "react";
import type { z } from "zod";
import type { NodeDefinition } from "../../core/manifest.js";
import type {
  ParameterDefinition,
  ParameterDefinitions,
  ParameterValues,
  PartialParameterValues,
} from "../../core/parameters.js";
import type { PortsDefinition } from "../../core/ports.js";

type NodeConfigPanelProps<
  TParameters extends ParameterDefinitions,
  TPorts extends PortsDefinition,
> = {
  readonly definition: NodeDefinition<TParameters, TPorts>;
  readonly value: PartialParameterValues<TParameters>;
  readonly onChange: (value: PartialParameterValues<TParameters>) => void;
};

const toNumber = (event: ChangeEvent<HTMLInputElement>) => {
  const nextValue = event.currentTarget.value;
  if (nextValue === "") {
    return;
  }
  return Number(nextValue);
};

const renderDescription = (description: string | undefined) => {
  if (!description) {
    return null;
  }
  return <p className="node-config-panel__description">{description}</p>;
};

export const NodeConfigPanel = <
  TParameters extends ParameterDefinitions,
  TPorts extends PortsDefinition,
>({
  definition,
  value,
  onChange,
}: NodeConfigPanelProps<TParameters, TPorts>) => {
  const entries = Object.entries(definition.parameters) as [
    keyof TParameters & string,
    ParameterDefinition<z.ZodTypeAny>,
  ][];

  const handleValueChange = <Key extends keyof TParameters & string>(
    parameterId: Key,
    nextValue: ParameterValues<TParameters>[Key] | undefined
  ) => {
    onChange({
      ...value,
      [parameterId]: nextValue,
    });
  };

  return (
    <form
      aria-label={`${definition.manifest.displayName} configuration`}
      className="node-config-panel"
    >
      {entries.map(([parameterId, parameter]) => {
        const fieldId = `${definition.manifest.id}-${parameterId}`;
        const control = parameter.control ?? "text";
        const currentValue = value[parameterId] as string | number | undefined;

        if (control === "textarea") {
          return (
            <label
              className="node-config-panel__field"
              htmlFor={fieldId}
              key={parameterId}
            >
              <span className="node-config-panel__label">
                {parameter.label}
              </span>
              <textarea
                id={fieldId}
                name={parameterId}
                onChange={(event) =>
                  handleValueChange(
                    parameterId,
                    event.currentTarget.value as never
                  )
                }
                rows={4}
                value={(currentValue as string | undefined) ?? ""}
              />
              {renderDescription(parameter.description)}
            </label>
          );
        }

        if (control === "number") {
          return (
            <label
              className="node-config-panel__field"
              htmlFor={fieldId}
              key={parameterId}
            >
              <span className="node-config-panel__label">
                {parameter.label}
              </span>
              <input
                id={fieldId}
                name={parameterId}
                onChange={(event) =>
                  handleValueChange(parameterId, toNumber(event) as never)
                }
                type="number"
                value={currentValue ?? ""}
              />
              {renderDescription(parameter.description)}
            </label>
          );
        }

        if (control === "select" && parameter.options) {
          return (
            <label
              className="node-config-panel__field"
              htmlFor={fieldId}
              key={parameterId}
            >
              <span className="node-config-panel__label">
                {parameter.label}
              </span>
              <select
                id={fieldId}
                name={parameterId}
                onChange={(event) =>
                  handleValueChange(
                    parameterId,
                    event.currentTarget.value as never
                  )
                }
                value={(currentValue as string | undefined) ?? ""}
              >
                {parameter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {renderDescription(parameter.description)}
            </label>
          );
        }

        return (
          <label
            className="node-config-panel__field"
            htmlFor={fieldId}
            key={parameterId}
          >
            <span className="node-config-panel__label">{parameter.label}</span>
            <input
              id={fieldId}
              name={parameterId}
              onChange={(event) =>
                handleValueChange(
                  parameterId,
                  event.currentTarget.value as never
                )
              }
              type="text"
              value={(currentValue as string | undefined) ?? ""}
            />
            {renderDescription(parameter.description)}
          </label>
        );
      })}
    </form>
  );
};
