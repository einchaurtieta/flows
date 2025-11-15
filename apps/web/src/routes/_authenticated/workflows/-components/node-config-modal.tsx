import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@flows/backend/convex/_generated/api.js";
import type { Doc, Id } from "@flows/backend/convex/_generated/dataModel.js";
import {
  HttpGetConfigPanel,
  type HttpGetParameterValues,
  httpGetNode,
  type SwitchParameterValues,
  switchNode,
} from "@flows/nodes/examples";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/design-system/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/design-system/dialog";
import { SwitchConfigForm } from "./switch-config-form";

type WorkflowNodeDoc = Doc<"nodes">;
type NodeParameters = Record<string, unknown>;

const manifestByType = {
  http: httpGetNode.manifest,
  switch: switchNode.manifest,
} as const;

type NodeConfigModalProps = {
  workflowId: Id<"workflows">;
  nodeId?: string;
  onClose: () => void;
};

export function NodeConfigModal({
  workflowId,
  nodeId,
  onClose,
}: NodeConfigModalProps) {
  const { data: workflow } = useSuspenseQuery(
    convexQuery(api.workflows.getWorflow, {
      workflowId,
    })
  );

  const node = useMemo(
    () =>
      (workflow.nodes?.find((_node) => _node._id === nodeId) ||
        null) as WorkflowNodeDoc | null,
    [nodeId, workflow.nodes]
  );

  useEffect(() => {
    if (nodeId && !node) {
      onClose();
    }
  }, [node, nodeId, onClose]);

  if (!(nodeId && node)) {
    return null;
  }

  const manifest = manifestByType[node.type as keyof typeof manifestByType];

  return (
    <Dialog
      modal
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open
    >
      <DialogContent className="h-full w-full overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{node.name ?? "Configure node"}</DialogTitle>
          {manifest?.description ? (
            <DialogDescription>{manifest.description}</DialogDescription>
          ) : (
            <DialogDescription>
              Update the parameters for this workflow node.
            </DialogDescription>
          )}
        </DialogHeader>
        <ConfigPanel node={node} />
        <div className="mt-4 flex justify-end">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Close
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConfigPanel({ node }: { node: WorkflowNodeDoc }) {
  if (node.type === "http") {
    return <HttpConfigForm node={node} />;
  }
  if (node.type === "switch") {
    return (
      <SwitchConfigForm
        initialValue={(node.parameters as SwitchParameterValues) ?? {}}
        nodeId={node._id as Id<"nodes">}
      />
    );
  }
  return (
    <p className="text-muted-foreground text-sm">
      Configuration for "{node.type}" nodes is not supported yet.
    </p>
  );
}

function HttpConfigForm({ node }: { node: WorkflowNodeDoc }) {
  const updateParameters = useConvexMutation(
    api.workflows.updateNodeParameters
  );
  const [params, setParams] = useState<NodeParameters>(
    (node.parameters as NodeParameters) ?? {}
  );

  useEffect(() => {
    setParams((node.parameters as NodeParameters) ?? {});
  }, [node.parameters]);

  const persist = useCallback(
    async (next: NodeParameters) => {
      setParams(next);
      await updateParameters({
        nodeId: node._id as Id<"nodes">,
        parameters: next,
      });
    },
    [node._id, updateParameters]
  );

  return (
    <HttpGetConfigPanel
      onChange={async (value) => {
        await persist(value as NodeParameters);
      }}
      value={(params as HttpGetParameterValues) ?? {}}
    />
  );
}
