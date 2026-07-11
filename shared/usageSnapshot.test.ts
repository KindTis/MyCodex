import type { DashboardResponse } from "./dashboardTypes.js";
import { toUsageSnapshotViewModel } from "./usageSnapshot.js";

const baseResponse: DashboardResponse = {
  generatedAt: "2026-06-26T12:34:56.000Z",
  status: "ok",
  today: { date: "2026-06-26", tokens: 123456, costUsd: 0 },
  trend: [],
  limits: [
    {
      id: "codex",
      name: "Codex",
      planType: "pro",
      primary: { label: "5h", usedPercent: 42.4, resetsAt: null, windowDurationMins: 300 },
      secondary: { label: "1w", usedPercent: 18, resetsAt: null, windowDurationMins: 10080 }
    }
  ],
  sources: {
    ccusage: { ok: true, message: null, checkedAt: "2026-06-26T12:34:56.000Z" },
    codexAppServer: { ok: true, message: null, checkedAt: "2026-06-26T12:34:56.000Z" }
  }
};

describe("toUsageSnapshotViewModel", () => {
  it("pending은 모든 값을 placeholder로 반환한다", () => {
    expect(toUsageSnapshotViewModel({ kind: "pending" })).toEqual({
      statusTone: "pending",
      todayTokensText: "--",
      todayCostText: "--",
      fiveHourLimitText: "--",
      fiveHourLimitFillPercent: 0,
      fiveHourResetText: "--",
      oneWeekLimitText: "--",
      oneWeekLimitFillPercent: 0,
      oneWeekResetText: "--",
      updatedAtText: "--:--:--"
    });
  });

  it("limit resetsAt은 로컬 M/D HH:mm 형식으로 반환한다", () => {
    const fiveHourResetsAt = "2026-07-11T14:30:00.000Z";
    const oneWeekResetsAt = "2026-07-18T03:05:00.000Z";
    const response = {
      ...baseResponse,
      limits: [
        {
          ...baseResponse.limits[0],
          primary: { ...baseResponse.limits[0].primary!, resetsAt: fiveHourResetsAt },
          secondary: { ...baseResponse.limits[0].secondary!, resetsAt: oneWeekResetsAt }
        }
      ]
    };

    const model = toUsageSnapshotViewModel({ kind: "response", response });
    expect(model.fiveHourResetText).toBe("7/11 23:30");
    expect(model.oneWeekResetText).toBe("7/18 12:05");
  });

  it("limit resetsAt이 없으면 reset text를 placeholder로 반환한다", () => {
    const model = toUsageSnapshotViewModel({ kind: "response", response: baseResponse });

    expect(model.fiveHourResetText).toBe("--");
    expect(model.oneWeekResetText).toBe("--");
  });

  it("두 source가 모두 성공인 response는 ok tone을 반환한다", () => {
    expect(toUsageSnapshotViewModel({ kind: "response", response: baseResponse }).statusTone).toBe("ok");
  });

  it("source 하나라도 실패한 response는 fail tone을 반환한다", () => {
    const response = {
      ...baseResponse,
      status: "partial" as const,
      sources: { ...baseResponse.sources, ccusage: { ok: false, message: "fail", checkedAt: baseResponse.generatedAt } }
    };

    expect(toUsageSnapshotViewModel({ kind: "response", response }).statusTone).toBe("fail");
  });

  it("ccusage 실패 response는 오늘 값만 placeholder로 표시하고 limit은 표시한다", () => {
    const response = {
      ...baseResponse,
      status: "partial" as const,
      today: null,
      sources: { ...baseResponse.sources, ccusage: { ok: false, message: "fail", checkedAt: baseResponse.generatedAt } }
    };

    const model = toUsageSnapshotViewModel({ kind: "response", response });

    expect(model.todayTokensText).toBe("--");
    expect(model.todayCostText).toBe("--");
    expect(model.fiveHourLimitText).toBe("42%");
  });

  it("Codex App Server 실패 response는 오늘 값만 표시하고 limit은 placeholder로 표시한다", () => {
    const response = {
      ...baseResponse,
      status: "partial" as const,
      sources: {
        ...baseResponse.sources,
        codexAppServer: { ok: false, message: "fail", checkedAt: baseResponse.generatedAt }
      }
    };

    const model = toUsageSnapshotViewModel({ kind: "response", response });

    expect(model.todayTokensText).toBe("123,456");
    expect(model.todayCostText).toBe("$0.0000");
    expect(model.fiveHourLimitText).toBe("--");
    expect(model.fiveHourResetText).toBe("--");
    expect(model.oneWeekLimitText).toBe("--");
    expect(model.oneWeekResetText).toBe("--");
  });

  it("100 초과 usedPercent는 text는 실제값, fill은 100으로 clamp한다", () => {
    const response = {
      ...baseResponse,
      limits: [
        {
          ...baseResponse.limits[0],
          primary: { label: "5h" as const, usedPercent: 123.4, resetsAt: null, windowDurationMins: 300 }
        }
      ]
    };

    const model = toUsageSnapshotViewModel({ kind: "response", response });

    expect(model.fiveHourLimitText).toBe("123%");
    expect(model.fiveHourLimitFillPercent).toBe(100);
  });

  it("성공 response의 generatedAt은 로컬 HH:mm:ss로 변환한다", () => {
    const model = toUsageSnapshotViewModel({ kind: "response", response: baseResponse });
    const expected = new Date(baseResponse.generatedAt);

    expect(model.updatedAtText).toBe(
      `${String(expected.getHours()).padStart(2, "0")}:${String(expected.getMinutes()).padStart(2, "0")}:${String(
        expected.getSeconds()
      ).padStart(2, "0")}`
    );
  });

  it("exception은 fail tone과 caughtAt 로컬 시간을 반환한다", () => {
    const model = toUsageSnapshotViewModel({ kind: "exception", caughtAt: new Date(2026, 5, 28, 1, 2, 3) });

    expect(model).toMatchObject({
      statusTone: "fail",
      todayTokensText: "--",
      todayCostText: "--",
      fiveHourLimitText: "--",
      fiveHourResetText: "--",
      oneWeekLimitText: "--",
      oneWeekResetText: "--",
      updatedAtText: "01:02:03"
    });
  });
});
