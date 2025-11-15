/** biome-ignore-all lint/nursery/noReactForwardRef: relax */
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { forwardRef, type ReactNode } from "react";

import { BaseNode } from "@/components/base-node";

export type PlaceholderNodeProps = Partial<NodeProps> & {
  children?: ReactNode;
  onClick?: () => void;
};

export const WorkflowNode = forwardRef<HTMLDivElement, PlaceholderNodeProps>(
  ({ children, onClick, isConnectable }, ref) => (
    <BaseNode
      className="flex cursor-pointer items-center justify-center border-gray-400 bg-card p-4 text-center text-gray-400"
      onClick={onClick}
      ref={ref}
    >
      {children}
      <Handle
        isConnectable={true}
        isConnectableStart={false}
        position={Position.Left}
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "15px",
          backgroundColor: "white",
          border: "1px solid var(--color-gray-400)",
        }}
        type="target"
      />
      <Handle
        isConnectable={isConnectable}
        position={Position.Right}
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "15px",
          backgroundColor: "white",
          border: "1px solid var(--color-gray-400)",
        }}
        type="source"
      />
    </BaseNode>
  )
);

WorkflowNode.displayName = "WorkflowNode";
