import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "@flows/backend/convex/_generated/api.js";
import type { Id } from "@flows/backend/convex/_generated/dataModel.js";
import type { SwitchParameterValues } from "@flows/nodes/examples";
import { useCallback, useEffect, useState } from "react";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from "@/components/design-system/field";
import { Input } from "@/components/design-system/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/design-system/select";

type SwitchConfigFormProps = {
  readonly nodeId: Id<"nodes">;
  readonly initialValue?: SwitchParameterValues;
};

const operatorOptions = [
  { label: "Equals", value: "equals" },
  { label: "Not equals", value: "notEquals" },
  { label: "Greater than", value: "greaterThan" },
  { label: "Less than", value: "lessThan" },
  { label: "Exists", value: "exists" },
  { label: "Not exists", value: "notExists" },
] as const;

const valueTypeOptions = [
  { label: "String", value: "string" },
  { label: "Number", value: "number" },
  { label: "Boolean", value: "boolean" },
] as const;

const missingRouteOptions = [
  { label: "Match", value: "match" },
  { label: "Default", value: "default" },
] as const;

const operatorsSkippingExpectedValue = new Set(["exists", "notExists"]);

const requiresExpectedValue = (operator?: string) =>
  operator ? !operatorsSkippingExpectedValue.has(operator) : true;

export function SwitchConfigForm({
  nodeId,
  initialValue,
}: SwitchConfigFormProps) {
  const updateParameters = useConvexMutation(
    api.workflows.updateNodeParameters
  );
  const [value, setValue] = useState<SwitchParameterValues>(initialValue ?? {});

  useEffect(() => {
    setValue(initialValue ?? {});
  }, [initialValue]);

  const persist = useCallback(
    (next: SwitchParameterValues) => {
      setValue(next);
      updateParameters({
        nodeId,
        parameters: next,
      }).catch(() => {});
    },
    [nodeId, updateParameters]
  );

  const mergeState = (next: SwitchParameterValues) => {
    persist({
      ...value,
      ...next,
    });
  };

  const handleOperatorChange = (
    operator: SwitchParameterValues["operator"]
  ) => {
    const nextState = {
      ...value,
      operator,
    };
    if (!requiresExpectedValue(operator)) {
      const { expectedValue: _value, ...rest } = nextState;
      persist(rest as SwitchParameterValues);
      return;
    }
    persist(nextState);
  };

  return (
    <FieldSet>
      <Field>
        <FieldLabel htmlFor="switch-path">
          <FieldTitle>Context path</FieldTitle>
        </FieldLabel>
        <FieldContent>
          <Input
            id="switch-path"
            name="path"
            onChange={(event) =>
              mergeState({ path: event.currentTarget.value })
            }
            placeholder="user.status"
            value={value.path ?? ""}
          />
          <FieldDescription>
            Dot-notation path within the workflow context (e.g.{" "}
            <code className="px-1">user.status</code>).
          </FieldDescription>
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel htmlFor="switch-operator">
          <FieldTitle>Operator</FieldTitle>
        </FieldLabel>
        <FieldContent>
          <Select
            onValueChange={(next) =>
              handleOperatorChange(next as SwitchParameterValues["operator"])
            }
            value={value.operator ?? undefined}
          >
            <SelectTrigger id="switch-operator">
              <SelectValue placeholder="Select an operator" />
            </SelectTrigger>
            <SelectContent>
              {operatorOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            Choose how to compare the resolved value against the expected one.
          </FieldDescription>
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel htmlFor="switch-value-type">
          <FieldTitle>Value type</FieldTitle>
        </FieldLabel>
        <FieldContent>
          <Select
            onValueChange={(next) =>
              mergeState({
                valueType: next as SwitchParameterValues["valueType"],
              })
            }
            value={value.valueType ?? undefined}
          >
            <SelectTrigger id="switch-value-type">
              <SelectValue placeholder="Select a type" />
            </SelectTrigger>
            <SelectContent>
              {valueTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            Determines how both sides of the comparison are coerced.
          </FieldDescription>
        </FieldContent>
      </Field>

      {requiresExpectedValue(value.operator) ? (
        <Field>
          <FieldLabel htmlFor="switch-expected-value">
            <FieldTitle>Expected value</FieldTitle>
          </FieldLabel>
          <FieldContent>
            <Input
              id="switch-expected-value"
              name="expectedValue"
              onChange={(event) =>
                mergeState({
                  expectedValue: event.currentTarget.value,
                })
              }
              placeholder="ok"
              value={value.expectedValue ?? ""}
            />
            <FieldDescription>
              Literal to compare against. Leave empty if the operator does not
              need a value.
            </FieldDescription>
          </FieldContent>
        </Field>
      ) : (
        <Field>
          <FieldLabel>
            <FieldTitle>Expected value</FieldTitle>
          </FieldLabel>
          <FieldContent>
            <FieldDescription>
              This operator does not require an expected value.
            </FieldDescription>
          </FieldContent>
        </Field>
      )}

      <Field>
        <FieldLabel htmlFor="switch-missing-route">
          <FieldTitle>Missing value route</FieldTitle>
        </FieldLabel>
        <FieldContent>
          <Select
            onValueChange={(next) =>
              mergeState({
                missingRoute: next as SwitchParameterValues["missingRoute"],
              })
            }
            value={value.missingRoute ?? undefined}
          >
            <SelectTrigger id="switch-missing-route">
              <SelectValue placeholder="Choose a fallback route" />
            </SelectTrigger>
            <SelectContent>
              {missingRouteOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            Route followed when the path resolves to no value.
          </FieldDescription>
        </FieldContent>
      </Field>
    </FieldSet>
  );
}
