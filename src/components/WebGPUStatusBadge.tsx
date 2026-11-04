import React from "react";
import { Cpu, Zap, AlertTriangle, Loader2 } from "lucide-react";
import { WebGPUCapability } from "../lib/webgpu";

interface WebGPUStatusBadgeProps {
  capability: WebGPUCapability | null;
  isLoading?: boolean;
}

export const WebGPUStatusBadge: React.FC<WebGPUStatusBadgeProps> = ({
  capability,
  isLoading,
}) => {
  if (isLoading || !capability) {
    return (
      <div
        className="inline-flex items-center gap-2 px-3 py-1 text-xs font-medium rounded bg-muted text-muted-foreground border border-border"
        title="Detecting graphics acceleration capabilities..."
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>Detecting WebGPU...</span>
      </div>
    );
  }

  if (capability.supported) {
    const deviceName =
      capability.adapterInfo?.device ||
      capability.adapterInfo?.vendor ||
      "Hardware Acceleration";
    return (
      <div
        className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded bg-status-ok/15 text-status-ok border border-status-ok/30"
        title={`WebGPU Active: ${deviceName}`}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded bg-status-ok opacity-75"></span>
          <span className="relative inline-flex rounded h-2 w-2 bg-status-ok"></span>
        </span>
        <Zap className="w-3.5 h-3.5 text-status-ok" />
        <span>WebGPU Active</span>
        {capability.adapterInfo?.device && (
          <span className="hidden sm:inline text-status-ok/80 font-normal">
            ({capability.adapterInfo.device})
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded bg-status-warn/15 text-status-warn border border-status-warn/30"
      title={capability.errorReason || "Running in CPU/WASM fallback mode"}
    >
      <AlertTriangle className="w-3.5 h-3.5 text-status-warn" />
      <Cpu className="w-3.5 h-3.5" />
      <span>Fallback Mode (CPU)</span>
    </div>
  );
};
