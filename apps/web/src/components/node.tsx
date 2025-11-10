/** biome-ignore-all lint/nursery/noReactForwardRef: relax */
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { forwardRef, type ReactNode } from "react";

import { BaseNode } from "@/components/base-node";

export type PlaceholderNodeProps = Partial<NodeProps> & {
  children?: ReactNode;
  onClick?: () => void;
};

export const WorkflowNode = forwardRef<HTMLDivElement, PlaceholderNodeProps>(
  ({ children, onClick }, ref) => (
    <BaseNode
      className="h-auto w-auto cursor-pointer border-gray-400 bg-card p-4 text-center text-gray-400 shadow-none hover:border-gray-500 hover:bg-gray-50"
      onClick={onClick}
      ref={ref}
    >
      {children}
      <Handle
        isConnectable={true}
        isConnectableStart={false}
        position={Position.Left}
        // style={{ visibility: "hidden" }}
        type="target"
      />
      <Handle
        isConnectable={true}
        position={Position.Right}
        // style={{ visibility: "hidden" }}
        type="source"
      />
    </BaseNode>
  )
);

WorkflowNode.displayName = "WorkflowNode";
