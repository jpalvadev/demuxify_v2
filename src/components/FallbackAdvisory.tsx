import React from 'react';
import { AlertCircle, Cpu, Info } from 'lucide-react';
import { WebGPUCapability } from '../lib/webgpu';

interface FallbackAdvisoryProps {
  capability: WebGPUCapability;
}

export const FallbackAdvisory: React.FC<FallbackAdvisoryProps> = ({ capability }) => {
  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200 shadow-sm transition-all"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
        <div className="space-y-1 text-sm">
          <div className="font-semibold text-amber-300 flex items-center gap-2">
            <span>Running in CPU/WASM Fallback Mode</span>
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
              <Cpu className="w-3 h-3" /> WASM
            </span>
          </div>
          <p className="text-amber-200/90 leading-relaxed">
            {capability.errorReason || 'WebGPU is not supported in this browser.'}
          </p>
          <div className="pt-2 flex items-center gap-1.5 text-xs text-amber-300/80">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>
              Audio separation will still execute 100% locally on your machine with zero server uploads, though inference times will be slower than hardware-accelerated WebGPU (recommended: Chrome 113+, Edge 113+, or Safari 18+).
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
