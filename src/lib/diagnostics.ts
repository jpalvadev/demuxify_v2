export type DiagnosticLevel = "info" | "warn" | "error" | "debug";
export type DiagnosticCategory =
  "system" | "inference" | "network" | "audio" | "general";

export interface DiagnosticEntry {
  id: string;
  timestamp: number;
  level: DiagnosticLevel;
  category: DiagnosticCategory;
  message: string;
  data?: unknown;
  stack?: string;
}

export interface DiagnosticsLoggerOptions {
  maxEntries?: number;
}

export class DiagnosticsLogger {
  private logs: DiagnosticEntry[] = [];
  private maxEntries: number;
  private listeners: Set<(logs: DiagnosticEntry[]) => void> = new Set();
  private originalConsoleError: typeof console.error | null = null;
  private originalConsoleWarn: typeof console.warn | null = null;
  private isIntercepting = false;

  constructor(options?: DiagnosticsLoggerOptions) {
    this.maxEntries = options?.maxEntries ?? 200;
  }

  public getLogs(): DiagnosticEntry[] {
    return [...this.logs];
  }

  public clear(): void {
    this.logs = [];
    this.notify();
  }

  public subscribe(listener: (logs: DiagnosticEntry[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getLogs());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const currentLogs = this.getLogs();
    for (const listener of this.listeners) {
      try {
        listener(currentLogs);
      } catch {
        // Prevent subscriber errors from bubbling
      }
    }
  }

  private addEntry(
    level: DiagnosticLevel,
    category: DiagnosticCategory,
    message: string,
    data?: unknown,
    stack?: string
  ): void {
    const entry: DiagnosticEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
      stack,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxEntries) {
      this.logs.shift();
    }
    this.notify();
  }

  public info(
    category: DiagnosticCategory,
    message: string,
    data?: unknown
  ): void {
    this.addEntry("info", category, message, data);
  }

  public warn(
    category: DiagnosticCategory,
    message: string,
    data?: unknown
  ): void {
    this.addEntry("warn", category, message, data);
  }

  public error(
    category: DiagnosticCategory,
    message: string,
    err?: unknown
  ): void {
    let stack: string | undefined;
    let data = err;

    if (err instanceof Error) {
      stack = err.stack;
      data = {
        name: err.name,
        message: err.message,
      };
    }

    this.addEntry("error", category, message, data, stack);
  }

  public debug(
    category: DiagnosticCategory,
    message: string,
    data?: unknown
  ): void {
    this.addEntry("debug", category, message, data);
  }

  public async getEnvironmentReport(): Promise<Record<string, unknown>> {
    const nav = typeof navigator !== "undefined" ? navigator : null;
    const navAny = nav as Record<string, unknown> | null;
    const perf = typeof performance !== "undefined" ? performance : null;
    const perfAny = perf as Record<string, unknown> | null;

    let webgpuStatus = "Unknown";
    let adapterInfo: unknown = null;

    if (navAny && "gpu" in navAny && navAny.gpu) {
      try {
        const gpu = navAny.gpu as { requestAdapter: () => Promise<any> };
        const adapter = await gpu.requestAdapter();
        if (adapter) {
          webgpuStatus = "Supported & Adapter Acquired";
          adapterInfo =
            adapter.info || (await adapter.requestAdapterInfo?.()) || {};
        } else {
          webgpuStatus = "Supported but no adapter found";
        }
      } catch (e) {
        webgpuStatus = `Adapter error: ${e instanceof Error ? e.message : String(e)}`;
      }
    } else {
      webgpuStatus = "Not available (no navigator.gpu)";
    }

    let memoryInfo: unknown = null;
    if (perfAny && perfAny.memory) {
      const mem = perfAny.memory as {
        jsHeapSizeLimit?: number;
        totalJSHeapSize?: number;
        usedJSHeapSize?: number;
      };
      memoryInfo = {
        jsHeapSizeLimitMB: mem.jsHeapSizeLimit
          ? Math.round(mem.jsHeapSizeLimit / 1048576)
          : undefined,
        totalJSHeapSizeMB: mem.totalJSHeapSize
          ? Math.round(mem.totalJSHeapSize / 1048576)
          : undefined,
        usedJSHeapSizeMB: mem.usedJSHeapSize
          ? Math.round(mem.usedJSHeapSize / 1048576)
          : undefined,
      };
    }

    let cacheStorage = "Not available";
    if (typeof globalThis !== "undefined" && "caches" in globalThis) {
      try {
        const keys = await globalThis.caches.keys();
        cacheStorage = `Available (Keys: ${keys.join(", ") || "none"})`;
      } catch {
        cacheStorage = "Error querying Cache Storage";
      }
    }

    return {
      userAgent: nav?.userAgent || "Unknown",
      platform: nav?.platform || "Unknown",
      deviceMemoryGB: navAny?.deviceMemory || "Unknown",
      hardwareConcurrency: nav?.hardwareConcurrency || "Unknown",
      webgpu: webgpuStatus,
      webgpuAdapter: adapterInfo,
      cacheStorage,
      memory: memoryInfo,
      screen:
        typeof window !== "undefined"
          ? `${window.innerWidth}x${window.innerHeight} (dpr: ${window.devicePixelRatio})`
          : "Headless",
    };
  }

  public async generateMarkdownReport(): Promise<string> {
    const env = await this.getEnvironmentReport();
    const envLines = Object.entries(env)
      .map(
        ([k, v]) =>
          `- **${k}**: ${typeof v === "object" ? JSON.stringify(v) : v}`
      )
      .join("\n");

    const logLines = this.logs.map((l) => {
      const time = new Date(l.timestamp).toISOString().substring(11, 23);
      const dataStr = l.data
        ? `\n  \`\`\`json\n  ${JSON.stringify(l.data, null, 2)}\n  \`\`\``
        : "";
      const stackStr = l.stack ? `\n  \`\`\`\n  ${l.stack}\n  \`\`\`` : "";
      return `[${time}] [${l.level.toUpperCase()}] [${l.category}] ${l.message}${dataStr}${stackStr}`;
    });

    return `# Demuxify Diagnostics Report

## Environment
${envLines}

## Logs (${this.logs.length} entries)
\`\`\`text
${logLines.length > 0 ? logLines.join("\n\n") : "No logs recorded."}
\`\`\`
`;
  }

  public installGlobalInterceptors(): () => void {
    if (this.isIntercepting) {
      return () => this.uninstallGlobalInterceptors();
    }

    this.isIntercepting = true;
    this.originalConsoleError = console.error;
    this.originalConsoleWarn = console.warn;

    console.error = (...args: unknown[]) => {
      this.originalConsoleError?.apply(console, args);
      const message = args
        .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
        .join(" ");
      const errArg = args.find((a) => a instanceof Error);
      this.error("general", message, errArg || args);
    };

    console.warn = (...args: unknown[]) => {
      this.originalConsoleWarn?.apply(console, args);
      const message = args
        .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
        .join(" ");
      this.warn("general", message, args);
    };

    const handleWindowError = (event: ErrorEvent) => {
      this.error("system", `Uncaught: ${event.message}`, event.error);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      this.error(
        "system",
        `Unhandled Rejection: ${event.reason}`,
        event.reason
      );
    };

    if (typeof window !== "undefined") {
      window.addEventListener("error", handleWindowError);
      window.addEventListener("unhandledrejection", handleRejection);
    }

    return () => {
      this.uninstallGlobalInterceptors();
      if (typeof window !== "undefined") {
        window.removeEventListener("error", handleWindowError);
        window.removeEventListener("unhandledrejection", handleRejection);
      }
    };
  }

  private uninstallGlobalInterceptors(): void {
    if (!this.isIntercepting) return;
    if (this.originalConsoleError) {
      console.error = this.originalConsoleError;
      this.originalConsoleError = null;
    }
    if (this.originalConsoleWarn) {
      console.warn = this.originalConsoleWarn;
      this.originalConsoleWarn = null;
    }
    this.isIntercepting = false;
  }

  public dispose(): void {
    this.uninstallGlobalInterceptors();
    this.listeners.clear();
    this.logs = [];
  }
}

export const diagnostics = new DiagnosticsLogger();
