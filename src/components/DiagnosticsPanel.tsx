import React, { useState, useEffect } from "react";
import {
  Terminal,
  Copy,
  Check,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Info,
  Cpu,
} from "lucide-react";
import {
  diagnostics,
  DiagnosticEntry,
  DiagnosticLevel,
} from "../lib/diagnostics";

// System Tab panel (ADR-0007): the floating pill trigger and the full-screen
// diagnostics overlay were deleted; logs and device report render inline.
export const DiagnosticsPanel: React.FC = () => {
  const [logs, setLogs] = useState<DiagnosticEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<DiagnosticLevel | "all">(
    "all"
  );
  const [activeTab, setActiveTab] = useState<"logs" | "env">("logs");
  const [envReport, setEnvReport] = useState<Record<string, unknown> | null>(
    null
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsubscribe = diagnostics.subscribe((newLogs) => {
      setLogs(newLogs);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    diagnostics.getEnvironmentReport().then(setEnvReport);
  }, []);

  const errorCount = logs.filter((l) => l.level === "error").length;

  const filteredLogs = logs.filter((log) => {
    if (filterLevel === "all") return true;
    return log.level === filterLevel;
  });

  const handleCopyReport = async () => {
    const markdown = await diagnostics.generateMarkdownReport();
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClearLogs = () => {
    diagnostics.clear();
  };

  return (
    <section
      role="region"
      aria-label="System Diagnostics"
      className="w-full rounded-2xl border border-border bg-card p-4 space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            System Diagnostics
          </h2>
          {errorCount > 0 && (
            <span className="rounded bg-destructive/20 px-2 py-0.5 text-xs font-semibold text-destructive">
              {errorCount} error{errorCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Sub-header Controls / Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-1 text-xs">
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setActiveTab("logs")}
            className={`rounded-md px-3 py-1 font-medium transition-colors ${
              activeTab === "logs"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Logs ({logs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("env")}
            className={`rounded-md px-3 py-1 font-medium transition-colors ${
              activeTab === "env"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Device & Engine
          </button>
        </div>

        {activeTab === "logs" && (
          <div className="flex items-center gap-1">
            {(["all", "error", "warn", "info"] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setFilterLevel(lvl)}
                className={`rounded px-2 py-1 uppercase text-[10px] font-semibold transition-colors ${
                  filterLevel === lvl
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="overflow-y-auto p-3 font-mono text-xs">
        {activeTab === "logs" ? (
          filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-muted-foreground text-center py-6">
              <Info className="h-6 w-6 mb-1 opacity-40" />
              <p>No logs recorded matching filter.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className={`rounded-lg border p-2 transition-colors ${
                    log.level === "error"
                      ? "border-destructive/40 bg-destructive/10 text-destructive-foreground"
                      : log.level === "warn"
                        ? "border-status-warn/40 bg-status-warn/10 text-foreground"
                        : "border-border bg-muted/20 text-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] opacity-70 mb-1">
                    <span className="flex items-center gap-1 font-bold uppercase">
                      {log.level === "error" && (
                        <AlertCircle className="h-3 w-3 text-destructive" />
                      )}
                      {log.level === "warn" && (
                        <AlertTriangle className="h-3 w-3 text-status-warn" />
                      )}
                      {log.level === "info" && (
                        <Info className="h-3 w-3 text-primary" />
                      )}
                      [{log.category}]
                    </span>
                    <span>
                      {new Date(log.timestamp).toISOString().substring(11, 23)}
                    </span>
                  </div>
                  <p className="font-semibold break-words leading-relaxed">
                    {log.message}
                  </p>
                  {log.data !== undefined && (
                    <pre className="mt-1 overflow-x-auto rounded bg-black/40 p-1.5 text-[10px] text-muted-foreground">
                      {typeof log.data === "object"
                        ? JSON.stringify(log.data, null, 2)
                        : String(log.data)}
                    </pre>
                  )}
                  {log.stack && (
                    <pre className="mt-1 overflow-x-auto rounded bg-destructive/20 p-1.5 text-[10px] text-destructive">
                      {log.stack}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold text-foreground border-b border-border pb-1">
              <Cpu className="h-4 w-4 text-primary" />
              <span>Device Environment & WebGPU Probes</span>
            </div>
            {envReport ? (
              <div className="grid grid-cols-1 gap-1.5 text-xs">
                {Object.entries(envReport).map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded border border-border bg-muted/20 p-1.5"
                  >
                    <span className="font-bold text-muted-foreground uppercase text-[10px] block">
                      {key}
                    </span>
                    <pre className="mt-0.5 break-words whitespace-pre-wrap font-sans text-xs">
                      {typeof value === "object"
                        ? JSON.stringify(value, null, 2)
                        : String(value)}
                    </pre>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">Probing environment...</p>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
        <button
          type="button"
          onClick={handleClearLogs}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-all"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear Logs
        </button>

        <button
          type="button"
          onClick={handleCopyReport}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy Report
            </>
          )}
        </button>
      </div>
    </section>
  );
};
