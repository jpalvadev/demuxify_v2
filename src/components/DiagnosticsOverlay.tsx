import React, { useState, useEffect } from "react";
import {
  Terminal,
  X,
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

export const DiagnosticsOverlay: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
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
    if (isOpen) {
      diagnostics.getEnvironmentReport().then(setEnvReport);
    }
  }, [isOpen]);

  const errorCount = logs.filter((l) => l.level === "error").length;
  const warnCount = logs.filter((l) => l.level === "warn").length;

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
    <>
      {/* Floating Toggle Button */}
      <button
        type="button"
        aria-label="Diagnostics"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-2 text-xs font-medium text-foreground shadow-lg backdrop-blur-md transition-all hover:bg-card hover:scale-105 active:scale-95"
      >
        <Terminal className="h-4 w-4 text-primary" />
        <span className="hidden sm:inline">Diagnostics</span>
        {errorCount > 0 ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground animate-pulse">
            {errorCount}
          </span>
        ) : warnCount > 0 ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
            {warnCount}
          </span>
        ) : null}
      </button>

      {/* Drawer / Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="System Diagnostics"
            className="flex h-[88vh] sm:h-[80vh] w-full max-w-2xl flex-col rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/40">
              <div className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">
                  System Diagnostics
                </h2>
                {errorCount > 0 && (
                  <span className="rounded bg-destructive/20 px-2 py-0.5 text-xs font-semibold text-destructive">
                    {errorCount} error{errorCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Sub-header Controls / Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2 bg-card text-xs">
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
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
              {activeTab === "logs" ? (
                filteredLogs.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-muted-foreground text-center p-6">
                    <Info className="h-8 w-8 mb-2 opacity-40" />
                    <p>No logs recorded matching filter.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredLogs.map((log) => (
                      <div
                        key={log.id}
                        className={`rounded-lg border p-2.5 transition-colors ${
                          log.level === "error"
                            ? "border-destructive/40 bg-destructive/10 text-destructive-foreground"
                            : log.level === "warn"
                              ? "border-amber-500/40 bg-amber-500/10 text-foreground"
                              : "border-border bg-muted/20 text-foreground"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[10px] opacity-70 mb-1">
                          <span className="flex items-center gap-1 font-bold uppercase">
                            {log.level === "error" && (
                              <AlertCircle className="h-3 w-3 text-destructive" />
                            )}
                            {log.level === "warn" && (
                              <AlertTriangle className="h-3 w-3 text-amber-500" />
                            )}
                            {log.level === "info" && (
                              <Info className="h-3 w-3 text-primary" />
                            )}
                            [{log.category}]
                          </span>
                          <span>
                            {new Date(log.timestamp)
                              .toISOString()
                              .substring(11, 23)}
                          </span>
                        </div>
                        <p className="font-semibold break-words leading-relaxed">
                          {log.message}
                        </p>
                        {log.data !== undefined && (
                          <pre className="mt-1.5 overflow-x-auto rounded bg-black/40 p-2 text-[10px] text-muted-foreground">
                            {typeof log.data === "object"
                              ? JSON.stringify(log.data, null, 2)
                              : String(log.data)}
                          </pre>
                        )}
                        {log.stack && (
                          <pre className="mt-1.5 overflow-x-auto rounded bg-destructive/20 p-2 text-[10px] text-destructive">
                            {log.stack}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 font-semibold text-foreground border-b border-border pb-1">
                    <Cpu className="h-4 w-4 text-primary" />
                    <span>Device Environment & WebGPU Probes</span>
                  </div>
                  {envReport ? (
                    <div className="grid grid-cols-1 gap-2 text-xs">
                      {Object.entries(envReport).map(([key, value]) => (
                        <div
                          key={key}
                          className="rounded border border-border bg-muted/20 p-2"
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
                    <p className="text-muted-foreground">
                      Probing environment...
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between border-t border-border px-4 py-2.5 bg-muted/40">
              <button
                type="button"
                onClick={handleClearLogs}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear Logs
              </button>

              <button
                type="button"
                onClick={handleCopyReport}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
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
          </div>
        </div>
      )}
    </>
  );
};
