import fixture from "../../tests/fixtures/ccusage-daily.json";
import { getCcusageProcessSpec, parseCcusageDaily } from "./ccusage.js";

const now = new Date(2026, 5, 26, 12, 0, 0);

describe("parseCcusageDaily", () => {
  it("오늘 사용량과 최근 7일 추이를 만든다", () => {
    const report = parseCcusageDaily(fixture, now);

    expect(report.today).toEqual({ date: "2026-06-26", tokens: 6000, costUsd: 0.06 });
    expect(report.trend).toHaveLength(7);
    expect(report.trend.map((point) => point.date)).toEqual([
      "2026-06-20",
      "2026-06-21",
      "2026-06-22",
      "2026-06-23",
      "2026-06-24",
      "2026-06-25",
      "2026-06-26"
    ]);
  });

  it("누락 날짜를 0으로 채운다", () => {
    const report = parseCcusageDaily(fixture, now);

    expect(report.trend[3]).toEqual({ date: "2026-06-23", tokens: 0, costUsd: 0 });
  });

  it("확인된 비용 필드를 요약에 기록한다", () => {
    const report = parseCcusageDaily(fixture, now);

    expect(report.summary.costField).toBe("totalCost");
    expect(report.summary.sevenDayTokens).toBe(21000);
    expect(report.summary.sevenDayCostUsd).toBeCloseTo(0.21);
  });

  it("costUSD 비용 필드도 지원한다", () => {
    const report = parseCcusageDaily(
      {
        data: [{ date: "2026-06-26", totalTokens: 123, costUSD: 0.5 }]
      },
      now
    );

    expect(report.today).toEqual({ date: "2026-06-26", tokens: 123, costUsd: 0.5 });
    expect(report.summary.costField).toBe("costUSD");
  });

  it("오늘 row가 없으면 오늘 사용량을 0으로 만든다", () => {
    const report = parseCcusageDaily({ daily: [] }, now);

    expect(report.today).toEqual({ date: "2026-06-26", tokens: 0, costUsd: 0 });
    expect(report.summary.todayMatched).toBe(false);
  });

  it("필수 필드가 잘못되면 실패한다", () => {
    expect(() =>
      parseCcusageDaily({ daily: [{ date: "2026-06-26", totalCost: 0.1 }] }, now)
    ).toThrow("totalTokens");
  });
});

describe("getCcusageProcessSpec", () => {
  it("Windows에서도 .cmd wrapper를 직접 실행하지 않고 node로 ccusage CLI를 실행한다", () => {
    const spec = getCcusageProcessSpec("C:\\work\\app", "C:\\node\\node.exe");

    expect(spec.command).toBe("C:\\node\\node.exe");
    expect(spec.args[0]).toBe("C:\\work\\app\\node_modules\\ccusage\\src\\cli.js");
    expect(spec.args.slice(1)).toEqual(["codex", "daily", "--json"]);
  });
});
