import React, { useEffect, useState } from "react";
import { Download, Check, Minus } from "lucide-react";
import { MODEL_PROFILES, ModelProfile } from "../lib/modelConfig";
import { isModelCached } from "../lib/modelCache";

// System Tab panel (ADR-0007): which Model Profiles are persisted in the
// Model Cache and their approximate sizes. Read-only status surfacing; the
// cache itself (modelCache lib) is untouched.
export const ModelCacheStatus: React.FC = () => {
  const profiles: ModelProfile[] = Object.values(MODEL_PROFILES).reduce(
    (acc, profile) => {
      if (acc.some((seen) => seen.cacheName === profile.cacheName)) {
        return acc;
      }
      acc.push(profile);
      return acc;
    },
    [] as ModelProfile[]
  );

  const [cachedFlags, setCachedFlags] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all(
      profiles.map((profile) =>
        isModelCached(profile.modelUrl, profile.cacheName).then(
          (cached): [string, boolean] => [profile.id, cached]
        )
      )
    ).then((pairs) => {
      const flags: Record<string, boolean> = {};
      for (const [id, cached] of pairs) {
        flags[id] = cached;
      }
      setCachedFlags(flags);
    });
  }, []);

  return (
    <section
      role="region"
      aria-label="Model Cache Status"
      className="w-full rounded-2xl border border-border/60 bg-card/60 p-3 space-y-2"
    >
      <div className="flex items-center gap-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Download className="h-3.5 w-3.5" />
        <span>Model Cache</span>
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {profiles.map((profile) => {
          const cached = cachedFlags[profile.id];
          return (
            <div
              key={profile.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-secondary/40 px-2.5 py-1.5"
            >
              <span className="text-xs text-foreground">
                {profile.name} · ~{profile.estimatedSizeMb} MB
              </span>
              {cached === undefined ? (
                <span className="text-[10px] font-mono uppercase text-muted-foreground">
                  Checking...
                </span>
              ) : cached ? (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-status-ok">
                  <Check className="h-3 w-3" />
                  Cached
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                  <Minus className="h-3 w-3" />
                  Not cached
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
