import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { epochSecondsToIso } from "./date.js";
import type { CodexAppServerSummary, CodexRateLimitReport, LimitBucket, LimitWindow } from "./types.js";
import { resolveNodeCommand, type NodeCommandOptions } from "../utils/process.js";

type RawLimitWindow = Record<string, unknown>;
type RawLimitBucket = Record<string, unknown>;

function unwrapPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object") {
    throw new Error("Codex App Server 응답이 객체가 아닙니다.");
  }

  const record = payload as Record<string, unknown>;
  if (record.result && typeof record.result === "object") {
    return record.result as Record<string, unknown>;
  }

  return record;
}

function collectBuckets(record: Record<string, unknown>): RawLimitBucket[] {
  const buckets = new Map<string, RawLimitBucket>();

  const addBucket = (value: unknown) => {
    if (!value || typeof value !== "object") {
      return;
    }

    const bucket = value as RawLimitBucket;
    const id = typeof bucket.limitId === "string" ? bucket.limitId : typeof bucket.id === "string" ? bucket.id : null;
    if (id) {
      buckets.set(id, bucket);
    }
  };

  addBucket(record.rateLimits);

  if (record.rateLimitsByLimitId && typeof record.rateLimitsByLimitId === "object") {
    const byId = record.rateLimitsByLimitId as Record<string, unknown>;
    for (const [id, value] of Object.entries(byId)) {
      if (value && typeof value === "object") {
        const bucket = value as RawLimitBucket;
        buckets.set(typeof bucket.limitId === "string" ? bucket.limitId : id, {
          ...bucket,
          limitId: typeof bucket.limitId === "string" ? bucket.limitId : id
        });
      }
    }
  }

  return [...buckets.values()];
}

function windowLabel(windowDurationMins: number): LimitWindow["label"] | null {
  if (windowDurationMins === 300) {
    return "5h";
  }
  if (windowDurationMins === 10_080) {
    return "1w";
  }
  return null;
}

function parseWindow(value: unknown, strict: boolean): LimitWindow | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as RawLimitWindow;
  const windowDurationMins =
    typeof record.windowDurationMins === "number" && Number.isFinite(record.windowDurationMins)
      ? record.windowDurationMins
      : null;
  const label = windowDurationMins === null ? null : windowLabel(windowDurationMins);
  if (!label) {
    return null;
  }

  const usedPercent = record.usedPercent;
  if (typeof usedPercent !== "number" || !Number.isFinite(usedPercent) || usedPercent < 0) {
    if (strict) {
      throw new Error(`${label} limit usedPercent가 올바르지 않습니다.`);
    }
    return null;
  }

  return {
    label,
    usedPercent,
    resetsAt: epochSecondsToIso(
      typeof record.resetsAt === "number" && Number.isFinite(record.resetsAt) ? record.resetsAt : null
    ),
    windowDurationMins
  };
}

function toLimitBucket(bucket: RawLimitBucket, strict: boolean): LimitBucket {
  const id = typeof bucket.limitId === "string" ? bucket.limitId : typeof bucket.id === "string" ? bucket.id : "";
  if (!id && strict) {
    throw new Error("limit bucket id를 찾지 못했습니다.");
  }

  const windows = [parseWindow(bucket.primary, strict), parseWindow(bucket.secondary, strict)];

  return {
    id,
    name: id === "codex" ? "Codex" : id,
    planType: typeof bucket.planType === "string" ? bucket.planType : null,
    primary: windows.find((window) => window?.label === "5h") ?? null,
    secondary: windows.find((window) => window?.label === "1w") ?? null
  };
}

export function parseCodexRateLimits(payload: unknown): CodexRateLimitReport {
  const record = unwrapPayload(payload);
  const rawBuckets = collectBuckets(record);
  const codexRaw = rawBuckets.find((bucket) => bucket.limitId === "codex" || bucket.id === "codex");

  if (!codexRaw) {
    throw new Error("Codex limit bucket을 찾지 못했습니다.");
  }

  const codex = toLimitBucket(codexRaw, true);
  const others = rawBuckets
    .filter((bucket) => bucket !== codexRaw)
    .map((bucket) => toLimitBucket(bucket, false))
    .filter((bucket) => bucket.id);
  const limits = [codex, ...others];

  return {
    limits,
    summary: {
      bucketIds: limits.map((bucket) => bucket.id),
      hasCodexBucket: true,
      primaryWindowDurationMins: codex.primary?.windowDurationMins ?? null,
      secondaryWindowDurationMins: codex.secondary?.windowDurationMins ?? null,
      primaryUsedPercent: codex.primary?.usedPercent ?? null,
      secondaryUsedPercent: codex.secondary?.usedPercent ?? null
    }
  };
}

type RpcMessage = Record<string, unknown>;

export function getCodexInitializeRequest(): RpcMessage {
  return {
    id: 1,
    method: "initialize",
    params: {
      clientInfo: {
        name: "mycodex-usage-dashboard",
        version: "0.1.0"
      },
      capabilities: {}
    }
  };
}

export function getCodexInitializedNotification(): RpcMessage {
  return {
    method: "initialized"
  };
}

type CodexAppServerProcessSpecOptions = NodeCommandOptions & {
  nodePath?: string;
  codexCliPath?: string | null;
  appDataPath?: string;
};

function getDefaultWindowsCodexCliPath(appDataPath = process.env.APPDATA): string | null {
  if (!appDataPath) {
    return null;
  }

  const candidate = path.join(appDataPath, "npm", "node_modules", "@openai", "codex", "bin", "codex.js");
  return fs.existsSync(candidate) ? candidate : null;
}

function getWindowsCodexCliPath(options: CodexAppServerProcessSpecOptions): string | null {
  if (Object.prototype.hasOwnProperty.call(options, "codexCliPath")) {
    return options.codexCliPath ?? null;
  }

  return getDefaultWindowsCodexCliPath(options.appDataPath);
}

export function getCodexAppServerProcessSpec(
  platform = process.platform,
  comSpec = process.env.ComSpec,
  options: CodexAppServerProcessSpecOptions = {}
): { command: string; args: string[] } {
  if (platform === "win32") {
    const codexCliPath = getWindowsCodexCliPath(options);
    if (codexCliPath) {
      return {
        command: resolveNodeCommand(options.nodePath ?? process.execPath, options),
        args: [codexCliPath, "app-server"]
      };
    }

    return {
      command: comSpec || "cmd.exe",
      args: ["/d", "/s", "/c", "codex.cmd app-server"]
    };
  }

  return {
    command: "codex",
    args: ["app-server"]
  };
}

export type CodexRateLimitsReaderOptions = {
  onChild?: (child: ChildProcess) => void;
  timeoutMs?: number;
};

export function createCodexRateLimitsReader(readerOptions: CodexRateLimitsReaderOptions = {}) {
  return function readCodexRateLimitsWithDeps(): Promise<CodexRateLimitReport> {
    const timeoutMs = readerOptions.timeoutMs ?? 20_000;

    return new Promise((resolve, reject) => {
    const spec = getCodexAppServerProcessSpec();
    const child = spawn(spec.command, spec.args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    readerOptions.onChild?.(child);

    let buffer = "";
    let stderr = "";
    let settled = false;
    let initialized = false;

    const finish = (error: Error | null, value?: CodexRateLimitReport) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      child.kill();
      if (error) {
        reject(error);
      } else {
        resolve(value as CodexRateLimitReport);
      }
    };

    const timer = setTimeout(() => {
      finish(new Error(`Codex App Server 호출 시간이 ${timeoutMs}ms를 초과했습니다.`));
    }, timeoutMs);

    const send = (message: RpcMessage) => {
      child.stdin.write(`${JSON.stringify(message)}\n`);
    };

    const handleMessage = (message: RpcMessage) => {
      if (message.id === 1 && !initialized) {
        initialized = true;
        send(getCodexInitializedNotification());
        send({ id: 2, method: "account/rateLimits/read", params: {} });
        return;
      }

      if (message.id === 2) {
        try {
          finish(null, parseCodexRateLimits(message));
        } catch (error) {
          finish(error instanceof Error ? error : new Error(String(error)));
        }
      }
    };

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }
        try {
          handleMessage(JSON.parse(line) as RpcMessage);
        } catch {
          finish(new Error("Codex App Server JSON-RPC 응답을 파싱하지 못했습니다."));
        }
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      finish(error);
    });
    child.on("close", (exitCode) => {
      if (!settled && exitCode !== 0) {
        finish(new Error(stderr || `Codex App Server가 종료 코드 ${exitCode}로 실패했습니다.`));
      }
    });

    send(getCodexInitializeRequest());
  });
  };
}

export function readCodexRateLimits(timeoutMs = 20_000): Promise<CodexRateLimitReport> {
  return createCodexRateLimitsReader({ timeoutMs })();
}
