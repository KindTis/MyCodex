import { createDashboardService } from "./dashboardService.js";
import { DebugStore } from "./debugStore.js";
import type { CcusageReport, CodexRateLimitReport } from "./types.js";

const at = new Date("2026-06-26T00:00:00.000Z");

const ccusageReport: CcusageReport = {
  today: { date: "2026-06-26", tokens: 100, costUsd: 0.1 },
  trend: [{ date: "2026-06-26", tokens: 100, costUsd: 0.1 }],
  summary: {
    rows: 1,
    todayMatched: true,
    costField: "totalCost",
    sevenDayTokens: 100,
    sevenDayCostUsd: 0.1
  }
};

const codexReport: CodexRateLimitReport = {
  limits: [
    {
      id: "codex",
      name: "Codex",
      planType: "pro",
      primary: { label: "5h", usedPercent: 12, resetsAt: null, windowDurationMins: 300 },
      secondary: { label: "1w", usedPercent: 3, resetsAt: null, windowDurationMins: 10080 }
    }
  ],
  summary: {
    bucketIds: ["codex"],
    hasCodexBucket: true,
    primaryWindowDurationMins: 300,
    secondaryWindowDurationMins: 10080,
    primaryUsedPercent: 12,
    secondaryUsedPercent: 3
  }
};

function service(
  ccusageReader: () => Promise<CcusageReport>,
  codexReader: () => Promise<CodexRateLimitReport>,
  store = new DebugStore()
) {
  return createDashboardService({
    ccusageReader,
    codexReader,
    store,
    now: () => at
  });
}

describe("dashboardService", () => {
  it("두 데이터 소스 성공 시 status ok를 반환한다", async () => {
    const dashboard = await service(
      () => Promise.resolve(ccusageReport),
      () => Promise.resolve(codexReport)
    ).getDashboard();

    expect(dashboard.status).toBe("ok");
    expect(dashboard.today).toEqual(ccusageReport.today);
    expect(dashboard.limits).toEqual(codexReport.limits);
  });

  it("ccusage만 실패하면 partial과 비어 있는 usage 영역을 반환한다", async () => {
    const dashboard = await service(
      () => Promise.reject(new Error("token=abc123456789 C:\\Users\\tester\\secret")),
      () => Promise.resolve(codexReport)
    ).getDashboard();

    expect(dashboard.status).toBe("partial");
    expect(dashboard.today).toBeNull();
    expect(dashboard.trend).toEqual([]);
    expect(dashboard.sources.ccusage.message).not.toContain("abc123456789");
    expect(dashboard.sources.ccusage.message).not.toContain("tester");
  });

  it("Codex App Server만 실패하면 partial과 비어 있는 limit 영역을 반환한다", async () => {
    const dashboard = await service(
      () => Promise.resolve(ccusageReport),
      () => Promise.reject(new Error("Bearer secret-token-123"))
    ).getDashboard();

    expect(dashboard.status).toBe("partial");
    expect(dashboard.limits).toEqual([]);
    expect(dashboard.sources.codexAppServer.message).not.toContain("secret-token-123");
  });

  it("양쪽 데이터 소스가 실패하면 error를 반환한다", async () => {
    const dashboard = await service(
      () => Promise.reject(new Error("ccusage failed")),
      () => Promise.reject(new Error("codex failed"))
    ).getDashboard();

    expect(dashboard.status).toBe("error");
    expect(dashboard.today).toBeNull();
    expect(dashboard.limits).toEqual([]);
  });

  it("성공/실패 시각과 원본 JSON 없는 debug payload를 반환한다", async () => {
    const store = new DebugStore();
    const app = service(
      () => Promise.resolve(ccusageReport),
      () => Promise.reject(new Error("raw {\"secret\":\"value\"} token=abcd12345678")),
      store
    );

    await app.getDashboard();
    const debug = app.getDebug();

    expect(debug.ccusage.lastSuccessAt).toBe(at.toISOString());
    expect(debug.codexAppServer.lastFailureAt).toBe(at.toISOString());
    expect(debug.errors).toHaveLength(1);
    expect(JSON.stringify(debug)).not.toContain("abcd12345678");
    expect(debug.ccusage.summary.rows).toBe(1);
  });
});
