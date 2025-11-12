'use strict';

import type { NodeDefinition } from "../core/manifest.js";
import type { ParameterDefinitions } from "../core/parameters.js";
import type { PortsDefinition } from "../core/ports.js";

type AnyNodeDefinition = NodeDefinition<ParameterDefinitions, PortsDefinition>;

export type NodeDiagnostic = {
  readonly message: string;
  readonly severity: "error" | "warning";
};

const idPattern = /^[a-z0-9-]+$/;
const versionPattern = /^\d+\.\d+\.\d+$/;

const validateId = (definition: AnyNodeDefinition, diagnostics: NodeDiagnostic[]) => {
  if (!idPattern.test(definition.manifest.id)) {
    diagnostics.push({
      severity: "error",
      message: `Node id "${definition.manifest.id}" must be lowercase kebab-case`,
    });
  }
};

const validateVersion = (definition: AnyNodeDefinition, diagnostics: NodeDiagnostic[]) => {
  if (!versionPattern.test(definition.manifest.version)) {
    diagnostics.push({
      severity: "warning",
      message: `Node ${definition.manifest.id} version should follow SemVer (x.y.z)`,
    });
  }
};

const validateKeys = (definition: AnyNodeDefinition, diagnostics: NodeDiagnostic[]) => {
  const parameterEntries = Object.entries(definition.parameters);
  for (const [key, parameter] of parameterEntries) {
    if (parameter.id !== key) {
      diagnostics.push({
        severity: "error",
        message: `Parameter key "${key}" must match its id "${parameter.id}"`,
      });
    }
  }

  const inputEntries = Object.entries(definition.ports.inputs);
  for (const [key, port] of inputEntries) {
    if (port.id !== key) {
      diagnostics.push({
        severity: "error",
        message: `Input port key "${key}" must match its id "${port.id}"`,
      });
    }
  }

  const outputEntries = Object.entries(definition.ports.outputs);
  for (const [key, port] of outputEntries) {
    if (port.id !== key) {
      diagnostics.push({
        severity: "error",
        message: `Output port key "${key}" must match its id "${port.id}"`,
      });
    }
  }
};

export const validateNodeDefinition = (definition: AnyNodeDefinition) => {
  const diagnostics: NodeDiagnostic[] = [];
  validateId(definition, diagnostics);
  validateVersion(definition, diagnostics);
  validateKeys(definition, diagnostics);
  return diagnostics;
};
