import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DiagnosticsLogger } from "../lib/diagnostics";

describe("DiagnosticsLogger", () => {
  let logger: DiagnosticsLogger;

  beforeEach(() => {
    logger = new DiagnosticsLogger({ maxEntries: 50 });
  });

  afterEach(() => {
    logger.dispose();
  });

  it("records log entries and notifies subscribers", () => {
    const subscriber = vi.fn();
    const unsubscribe = logger.subscribe(subscriber);

    logger.info("inference", "Inference session initialized");
    logger.warn("network", "Slow download detected", { loaded: 100 });
    logger.error("system", "WebGPU adapter failed", new Error("Device lost"));

    const logs = logger.getLogs();
    expect(logs).toHaveLength(3);
    expect(logs[0].message).toBe("Inference session initialized");
    expect(logs[0].category).toBe("inference");
    expect(logs[0].level).toBe("info");

    expect(logs[1].level).toBe("warn");
    expect(logs[1].data).toEqual({ loaded: 100 });

    expect(logs[2].level).toBe("error");
    expect(logs[2].message).toBe("WebGPU adapter failed");
    expect(logs[2].stack).toBeDefined();

    expect(subscriber).toHaveBeenCalled();
    unsubscribe();
  });

  it("caps log history at maxEntries (ring buffer behavior)", () => {
    const smallLogger = new DiagnosticsLogger({ maxEntries: 5 });
    for (let i = 0; i < 10; i++) {
      smallLogger.info("general", `Message ${i}`);
    }

    const logs = smallLogger.getLogs();
    expect(logs).toHaveLength(5);
    expect(logs[0].message).toBe("Message 5");
    expect(logs[4].message).toBe("Message 9");
  });

  it("clears logs correctly", () => {
    logger.info("general", "Test");
    expect(logger.getLogs()).toHaveLength(1);
    logger.clear();
    expect(logger.getLogs()).toHaveLength(0);
  });

  it("generates a comprehensive markdown report for mobile debugging", async () => {
    logger.info("inference", "Started chunk 1");
    logger.error(
      "inference",
      "OOM in worker",
      new Error("Memory limit exceeded")
    );

    const report = await logger.generateMarkdownReport();
    expect(report).toContain("# Demuxify Diagnostics Report");
    expect(report).toContain("OOM in worker");
    expect(report).toContain("Started chunk 1");
    expect(report).toContain("Environment");
  });

  it("intercepts global console errors and unhandled rejections", () => {
    const uninstall = logger.installGlobalInterceptors();

    console.error("Test console error interception", { code: 500 });
    console.warn("Test console warning interception");

    const logs = logger.getLogs();
    const errorLog = logs.find((l) =>
      l.message.includes("Test console error interception")
    );
    const warnLog = logs.find((l) =>
      l.message.includes("Test console warning interception")
    );

    expect(errorLog).toBeDefined();
    expect(errorLog?.level).toBe("error");
    expect(warnLog).toBeDefined();
    expect(warnLog?.level).toBe("warn");

    uninstall();
  });
});
