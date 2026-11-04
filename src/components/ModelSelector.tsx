import React from "react";
import {
  Sparkles,
  Zap,
  Gauge,
  Smartphone,
  Check,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import {
  ModelId,
  ModelProfile,
  MODEL_PROFILES,
  BS_ROFORMER_PROFILE,
  listModelProfiles,
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

  const profiles = listModelProfiles();
  const isStudioSelected = activeProfile.id === "bs-roformer-4stem";

  return (
    <div
      role="region"
      aria-label="Model Profile Selection"
      className="rounded border border-st-hairline bg-st-panel p-4 shadow-xs space-y-3"
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

      {/* Mobile Device Protection Advisory Banner */}
      {isMobile && !isStudioSelected && (
        <div
          role="region"
          aria-label="Active Model Profile Advisory"
          className="rounded border border-primary/20 bg-primary/5 p-3"
        >
          <div className="flex items-start gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
              <Smartphone className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Mobile-Optimized Model Active
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-status-ok/10 px-2 py-0.5 text-[10px] font-medium text-status-ok">
                  <ShieldCheck className="h-3 w-3" />
                  Memory Protected
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Demuxify Web automatically selects this lightweight profile to
                preserve memory and prevent browser crashes on smartphones and
                tablets while extracting all 4 discrete Stems.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Warning if Studio is selected */}
      {isMobile && isStudioSelected && (
        <div
          role="alert"
          className="rounded border border-status-warn/30 bg-status-warn/10 p-3 text-xs text-status-warn flex items-start gap-2.5"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-status-warn mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-semibold">
              Studio Profile on Mobile Warning
            </div>
            <p className="text-[11px] leading-relaxed">
              Studio mode requires ~1.5 GB memory and dedicated WebGPU. It may
              crash or run very slowly on smartphones. Ultra Fast or Balanced is
              recommended for mobile devices.
            </p>
          </div>
        </div>
      )}

      {/* Interactive 3-Model Selector Grid */}
      <div
        role="radiogroup"
        aria-label="Model Profile selection"
        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
      >
        {profiles.map((profile) => {
          const isSelected = selectedModelId === profile.id;
          const isFast =
            profile.id === "open-unmix-4stem" || profile.id === "umx-4stem";
          const isBalanced =
            profile.id === "htdemucs-4stem" || profile.id === "mdx-net-4stem";
          const Icon = isFast ? Zap : isBalanced ? Gauge : Sparkles;

          return (
            <button
              key={profile.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onSelectModel(profile.id)}
              className={`relative flex flex-col justify-between rounded border p-3.5 text-left transition-all ${
                isSelected
                  ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30"
                  : "border-st-hairline bg-st-panel hover:border-st-highlight"
              } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
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
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </div>
                )}
              </div>

              <div className="text-xs font-medium text-foreground/90 mt-1">
                {profile.name}
              </div>

              <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                {profile.tagline}
              </div>
            </button>
          );
        })}
      </div>

      {/* Explanation Callout for Selected Model */}
      <div className="rounded border border-border/60 bg-muted/30 p-2.5 text-xs text-muted-foreground flex items-center gap-2">
        <span className="text-[11px] font-medium text-foreground">
          {activeProfile.shortName} Mode:
        </span>
        <span className="text-[11px]">{activeProfile.explanation}</span>
      </div>
    </div>
  );
};
