import React from "react";
import { Sparkles, Zap, Smartphone, Check, ShieldCheck } from "lucide-react";
import {
  ModelId,
  ModelProfile,
  MODEL_PROFILES,
  BS_ROFORMER_PROFILE,
  MDX_NET_PROFILE,
} from "../lib/modelConfig";

export interface ModelSelectorProps {
  selectedModelId: ModelId;
  onSelectModel: (id: ModelId) => void;
  isMobile: boolean;
  disabled?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModelId,
  onSelectModel,
  isMobile,
  disabled = false,
}) => {
  const activeProfile: ModelProfile =
    MODEL_PROFILES[selectedModelId] || BS_ROFORMER_PROFILE;

  // On mobile devices, lock to MDX-Net 4-Stem with protective advisory
  if (isMobile) {
    return (
      <div
        role="region"
        aria-label="Active Model Profile Advisory"
        className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-xs"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Mobile-Optimized Model Active
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-3 w-3" />
                Memory Protected
              </span>
            </div>
            <h4 className="text-sm font-semibold text-foreground">
              {MDX_NET_PROFILE.name} (~{MDX_NET_PROFILE.estimatedSizeMb} MB)
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Demuxify Web automatically selects this lightweight profile to
              preserve memory and prevent browser crashes on smartphones and
              tablets while extracting all 4 discrete Stems.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // On desktop browsers, render interactive Model Selector control
  const profiles = [BS_ROFORMER_PROFILE, MDX_NET_PROFILE];

  return (
    <div
      role="region"
      aria-label="Model Profile Selection"
      className="rounded-2xl border border-border bg-card/60 p-4 shadow-xs space-y-3"
    >
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Model Profile
          </span>
          <p className="text-xs text-muted-foreground">
            Choose separation model profile based on your workflow and hardware
          </p>
        </div>
      </div>

      <div
        role="radiogroup"
        aria-label="Model Profile selection"
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        {profiles.map((profile) => {
          const isSelected = selectedModelId === profile.id;
          const isStudio = profile.id === "bs-roformer-4stem";

          return (
            <button
              key={profile.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onSelectModel(profile.id)}
              className={`relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all ${
                isSelected
                  ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30"
                  : "border-border bg-card/40 hover:bg-muted/40 hover:border-border/80"
              } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isStudio ? (
                      <Sparkles className="h-4 w-4" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-foreground">
                      {profile.shortName}
                    </span>
                    <span className="text-[11px] text-muted-foreground ml-1.5 font-mono">
                      (~{profile.estimatedSizeMb} MB)
                    </span>
                  </div>
                </div>

                {isSelected && (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </div>
                )}
              </div>

              <div className="text-xs font-medium text-foreground/90 mt-1">
                {profile.name}
              </div>

              <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                {isStudio
                  ? "Maximum acoustic isolation and studio fidelity"
                  : "Rapid 4-stem separation with minimal memory footprint"}
              </div>
            </button>
          );
        })}
      </div>

      {/* Explanation Callout for Selected Model */}
      <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5 text-xs text-muted-foreground flex items-center gap-2">
        <span className="text-[11px] font-medium text-foreground">
          {activeProfile.shortName} Mode:
        </span>
        <span className="text-[11px]">{activeProfile.explanation}</span>
      </div>
    </div>
  );
};
