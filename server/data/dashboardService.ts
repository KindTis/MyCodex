import { readCcusageDaily } from "./ccusage.js";
import { readCodexRateLimits } from "./codexAppServer.js";
import { DebugStore, debugStore } from "./debugStore.js";
import {
  type CcusageReport,
  type CodexRateLimitReport,
  type DashboardRequest,
  type DashboardResponse,
  type DebugResponse
} from "./types.js";
import { sanitizeMessage } from "../utils/sanitize.js";

type DashboardServiceDeps = {
  ccusageReader?: (options?: DashboardRequest) => Promise<CcusageReport>;
  codexReader?: () => Promise<CodexRateLimitReport>;
  store?: DebugStore;
  now?: () => Date;
};

function sourceStatus(ok: boolean, message: string | null, checkedAt: string) {
  return { ok, message, checkedAt };
}

function runReader<T>(reader: () => Promise<T>): Promise<T> {
  return Promise.resolve().then(reader);
}

export function createDashboardService(deps: DashboardServiceDeps = {}) {
  const ccusageReader = deps.ccusageReader ?? readCcusageDaily;
  const codexReader = deps.codexReader ?? readCodexRateLimits;
  const store = deps.store ?? debugStore;
  const now = deps.now ?? (() => new Date());

  async function getDashboard(options: DashboardRequest = {}): Promise<DashboardResponse> {
    const weekOffset = Number.isInteger(options.weekOffset) && (options.weekOffset ?? 0) > 0 ? options.weekOffset : 0;
    const [ccusageResult, codexResult] = await Promise.allSettled([
      runReader(() => ccusageReader({ weekOffset })),
      runReader(codexReader)
    ]);
    const generatedAt = now().toISOString();
    const ccusageOk = ccusageResult.status === "fulfilled";
    const codexOk = codexResult.status === "fulfilled";

    if (ccusageOk) {
      store.recordSuccess("ccusage", generatedAt, ccusageResult.value.summary);
    } else {
      store.recordFailure("ccusage", generatedAt, sanitizeMessage(ccusageResult.reason));
    }

    if (codexOk) {
      store.recordSuccess("codexAppServer", generatedAt, codexResult.value.summary);
    } else {
      store.recordFailure("codexAppServer", generatedAt, sanitizeMessage(codexResult.reason));
    }

    const status = ccusageOk && codexOk ? "ok" : ccusageOk || codexOk ? "partial" : "error";

    return {
      generatedAt,
      status,
      today: ccusageOk ? ccusageResult.value.today : null,
      trend: ccusageOk ? ccusageResult.value.trend : [],
      limits: codexOk ? codexResult.value.limits : [],
      sources: {
        ccusage: sourceStatus(ccusageOk, ccusageOk ? null : sanitizeMessage(ccusageResult.reason), generatedAt),
        codexAppServer: sourceStatus(codexOk, codexOk ? null : sanitizeMessage(codexResult.reason), generatedAt)
      }
    };
  }

  function getDebug(): DebugResponse {
    const snapshot = store.snapshot();

    return {
      generatedAt: now().toISOString(),
      ccusage: snapshot.ccusage,
      codexAppServer: snapshot.codexAppServer,
      errors: snapshot.errors
    };
  }

  return {
    getDashboard,
    getDebug
  };
}

export const dashboardService = createDashboardService();
