/** biome-ignore-all lint/nursery/noReactForwardRef: relax */
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { forwardRef, type ReactNode } from "react";

import { BaseNode } from "@/components/base-node";

export type PlaceholderNodeProps = Partial<NodeProps> & {
  children?: ReactNode;
  onClick?: () => void;
};

export const TriggerNode = forwardRef<HTMLDivElement, PlaceholderNodeProps>(
  ({ children, onClick }, ref) => (
    <BaseNode
      className="h-auto w-auto cursor-pointer border-gray-400 border-dashed bg-card p-4 text-center text-gray-400 shadow-none"
      onClick={onClick}
      ref={ref}
    >
      {children}

      <Handle
        isConnectable={true}
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

TriggerNode.displayName = "TriggerNode";
