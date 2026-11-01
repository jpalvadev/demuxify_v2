import React from "react";
import { AlertCircle, Cpu, Info } from "lucide-react";
import { WebGPUCapability } from "../lib/webgpu";

interface FallbackAdvisoryProps {
  capability: WebGPUCapability;
}

export const FallbackAdvisory: React.FC<FallbackAdvisoryProps> = ({
  capability,
}) => {
  return (
    <div
      role="alert"
      className="rounded-none border border-status-warn/30 bg-status-warn/10 p-4 text-status-warn shadow-sm transition-all"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-status-warn mt-0.5 shrink-0" />
        <div className="space-y-1 text-sm">
          <div className="font-semibold text-status-warn flex items-center gap-2">
            <span>Running in CPU/WASM Fallback Mode</span>
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-status-warn/20 text-status-warn font-mono">
              <Cpu className="w-3 h-3" /> WASM
            </span>
          </div>
          <p className="text-status-warn/90 leading-relaxed">
            {capability.errorReason ||
              "WebGPU is not supported in this browser."}
          </p>
          <div className="pt-2 flex items-center gap-1.5 text-xs text-status-warn/80">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>
              Audio separation will still execute 100% locally on your machine
              with zero server uploads, though inference times will be slower
              than hardware-accelerated WebGPU (recommended: Chrome 113+, Edge
              113+, or Safari 18+).
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
