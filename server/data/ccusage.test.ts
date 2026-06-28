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

  it("weekOffset으로 이전 7일 구간 추이를 만든다", () => {
    const report = parseCcusageDaily(
      {
        daily: [
          { date: "2026-06-06", totalTokens: 100, totalCost: 0.01 },
          { date: "2026-06-09", totalTokens: 200, totalCost: 0.02 },
          { date: "2026-06-12", totalTokens: 300, totalCost: 0.03 },
          { date: "2026-06-26", totalTokens: 999, totalCost: 0.99 }
        ]
      },
      now,
      { weekOffset: 2 }
    );

    expect(report.trend.map((point) => point.date)).toEqual([
      "2026-06-06",
      "2026-06-07",
      "2026-06-08",
      "2026-06-09",
      "2026-06-10",
      "2026-06-11",
      "2026-06-12"
    ]);
    expect(report.trend[0]).toEqual({ date: "2026-06-06", tokens: 100, costUsd: 0.01 });
    expect(report.trend[3]).toEqual({ date: "2026-06-09", tokens: 200, costUsd: 0.02 });
    expect(report.summary.sevenDayTokens).toBe(600);
  });

  it("필수 필드가 잘못되면 실패한다", () => {
    expect(() =>
      parseCcusageDaily({ daily: [{ date: "2026-06-26", totalCost: 0.1 }] }, now)
    ).toThrow("totalTokens");
  });

  it("오늘이 아닌 row라도 date가 잘못되면 실패한다", () => {
    expect(() =>
      parseCcusageDaily({ daily: [{ date: "2026-6-25", totalTokens: 1, totalCost: 0.1 }] }, now)
    ).toThrow("date");
    expect(() =>
      parseCcusageDaily({ daily: [{ date: "2026-02-30", totalTokens: 1, totalCost: 0.1 }] }, now)
    ).toThrow("date");
  });

  it.each([null, "1", Number.NaN, Infinity, -1])("totalTokens가 %s이면 실패한다", (totalTokens) => {
    expect(() =>
      parseCcusageDaily({ daily: [{ date: "2026-06-26", totalTokens, totalCost: 0.1 }] }, now)
    ).toThrow("totalTokens");
  });

  it.each([null, "0.1", Number.NaN, Infinity, -0.1])("선택된 비용 필드가 %s이면 실패한다", (totalCost) => {
    expect(() =>
      parseCcusageDaily({ daily: [{ date: "2026-06-26", totalTokens: 1, totalCost }] }, now)
    ).toThrow("비용");
  });

  it("totalCost가 하나라도 있으면 응답 단위 비용 필드로 totalCost를 요구한다", () => {
    expect(() =>
      parseCcusageDaily(
        {
          daily: [
            { date: "2026-06-25", totalTokens: 1, costUSD: 0.1 },
            { date: "2026-06-26", totalTokens: 2, totalCost: 0.2 }
          ]
        },
        now
      )
    ).toThrow("비용");
  });

  it("오늘 row가 없고 나머지 row가 정상인 경우만 today를 0으로 정규화한다", () => {
    const report = parseCcusageDaily(
      { daily: [{ date: "2026-06-25", totalTokens: 10, totalCost: 0.1 }] },
      now
    );

    expect(report.today).toEqual({ date: "2026-06-26", tokens: 0, costUsd: 0 });
    expect(report.summary.todayMatched).toBe(false);
  });
});

describe("getCcusageProcessSpec", () => {
  it("Windows에서도 .cmd wrapper를 직접 실행하지 않고 node로 ccusage CLI를 실행한다", () => {
    const spec = getCcusageProcessSpec("C:\\work\\app", "C:\\node\\node.exe");

    expect(spec.command).toBe("C:\\node\\node.exe");
    expect(spec.args[0]).toBe("C:\\work\\app\\node_modules\\ccusage\\src\\cli.js");
    expect(spec.args.slice(1)).toEqual(["codex", "daily", "--json"]);
  });

  it("Electron 런타임에서는 electron.exe 대신 node로 ccusage CLI를 실행한다", () => {
    const spec = getCcusageProcessSpec("C:\\work\\app", "C:\\Electron\\electron.exe", { isElectronRuntime: true });

    expect(spec.command).toBe("node");
    expect(spec.args[0]).toBe("C:\\work\\app\\node_modules\\ccusage\\src\\cli.js");
    expect(spec.args.slice(1)).toEqual(["codex", "daily", "--json"]);
  });

  it("packaged 앱에서는 주입된 앱 루트에서 ccusage CLI를 찾는다", () => {
    const spec = getCcusageProcessSpec("C:\\packed\\resources\\app", "C:\\node\\node.exe");

    expect(spec.args[0]).toBe("C:\\packed\\resources\\app\\node_modules\\ccusage\\src\\cli.js");
  });
});
