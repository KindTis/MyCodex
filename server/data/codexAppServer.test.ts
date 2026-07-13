import fixture from "../../tests/fixtures/codex-rate-limits.json";
import {
  getCodexAppServerProcessSpec,
  getCodexInitializeRequest,
  getCodexInitializedNotification,
  parseCodexRateLimits
} from "./codexAppServer.js";

describe("parseCodexRateLimits", () => {
  it("Codex bucket을 5시간/1주 window로 매핑한다", () => {
    const report = parseCodexRateLimits(fixture);

    expect(report.limits[0].id).toBe("codex");
    expect(report.limits[0].primary).toMatchObject({
      label: "5h",
      usedPercent: 42.5,
      windowDurationMins: 300,
      resetsAt: new Date(1782447139 * 1000).toISOString()
    });
    expect(report.limits[0].secondary).toMatchObject({
      label: "1w",
      usedPercent: 18,
      windowDurationMins: 10080
    });
  });

  it("추가 bucket이 있어도 Codex bucket을 먼저 반환한다", () => {
    const report = parseCodexRateLimits(fixture);

    expect(report.limits.map((bucket) => bucket.id)).toEqual(["codex", "chatgpt"]);
    expect(report.summary.bucketIds).toEqual(["codex", "chatgpt"]);
  });

  it("Codex bucket 누락을 실패로 처리한다", () => {
    expect(() => parseCodexRateLimits({ rateLimitsByLimitId: {} })).toThrow("Codex limit bucket");
  });

  it("잘못된 usedPercent를 실패로 처리한다", () => {
    expect(() =>
      parseCodexRateLimits({
        rateLimits: {
          limitId: "codex",
          primary: { usedPercent: "bad", windowDurationMins: 300 },
          secondary: { usedPercent: 1, windowDurationMins: 10080 }
        }
      })
    ).toThrow("usedPercent");
  });

  it("대표 bucket의 음수 usedPercent를 실패로 처리한다", () => {
    expect(() =>
      parseCodexRateLimits({
        rateLimits: {
          limitId: "codex",
          primary: { usedPercent: -1, windowDurationMins: 300 },
          secondary: { usedPercent: 1, windowDurationMins: 10080 }
        }
      })
    ).toThrow("usedPercent");
  });

  it("1주 window만 primary로 제공되면 1주 limit으로 매핑한다", () => {
    const report = parseCodexRateLimits({
      rateLimits: {
        limitId: "codex",
        primary: { usedPercent: 18, windowDurationMins: 10080, resetsAt: 1782965539 },
        secondary: null
      }
    });

    expect(report.limits[0].primary).toBeNull();
    expect(report.limits[0].secondary).toMatchObject({
      label: "1w",
      usedPercent: 18,
      windowDurationMins: 10080
    });
    expect(report.summary.primaryWindowDurationMins).toBeNull();
    expect(report.summary.secondaryWindowDurationMins).toBe(10080);
  });

  it("5시간 window만 secondary로 제공되어도 5시간 limit으로 매핑한다", () => {
    const report = parseCodexRateLimits({
      rateLimits: {
        limitId: "codex",
        primary: null,
        secondary: { usedPercent: 7, windowDurationMins: 300 }
      }
    });

    expect(report.limits[0].primary).toMatchObject({
      label: "5h",
      usedPercent: 7,
      windowDurationMins: 300
    });
    expect(report.limits[0].secondary).toBeNull();
  });

  it("지원하지 않는 duration은 해당 limit이 없는 것으로 처리한다", () => {
    const report = parseCodexRateLimits({
      rateLimits: {
        limitId: "codex",
        primary: { usedPercent: 1, windowDurationMins: 15 },
        secondary: null
      }
    });

    expect(report.limits[0].primary).toBeNull();
    expect(report.limits[0].secondary).toBeNull();
  });

  it("첫 bucket이 chatgpt여도 codex bucket만 대표로 사용한다", () => {
    const report = parseCodexRateLimits({
      rateLimitsByLimitId: {
        chatgpt: {
          limitId: "chatgpt",
          primary: { usedPercent: 99, windowDurationMins: 300 },
          secondary: { usedPercent: 88, windowDurationMins: 10080 }
        },
        codex: {
          limitId: "codex",
          primary: { usedPercent: 7, windowDurationMins: 300 },
          secondary: { usedPercent: 8, windowDurationMins: 10080 }
        }
      }
    });

    expect(report.limits[0].id).toBe("codex");
    expect(report.limits[0].primary?.usedPercent).toBe(7);
  });

  it("JSON-RPC result wrapper를 처리한다", () => {
    const report = parseCodexRateLimits({ result: fixture });

    expect(report.summary.hasCodexBucket).toBe(true);
    expect(report.summary.primaryUsedPercent).toBe(42.5);
  });
});

describe("getCodexAppServerProcessSpec", () => {
  it("Windows에서는 cmd wrapper 대신 node로 Codex CLI 스크립트를 실행한다", () => {
    const codexCliPath = "C:\\Users\\tester\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\bin\\codex.js";
    const spec = getCodexAppServerProcessSpec("win32", "C:\\Windows\\System32\\cmd.exe", {
      nodePath: "C:\\node\\node.exe",
      codexCliPath
    });

    expect(spec.command).toBe("C:\\node\\node.exe");
    expect(spec.args).toEqual([codexCliPath, "app-server"]);
  });

  it("Windows에서 Codex CLI 스크립트를 찾지 못하면 cmd wrapper로 fallback한다", () => {
    const spec = getCodexAppServerProcessSpec("win32", "C:\\Windows\\System32\\cmd.exe", { codexCliPath: null });

    expect(spec.command).toBe("C:\\Windows\\System32\\cmd.exe");
    expect(spec.args).toEqual(["/d", "/s", "/c", "codex.cmd app-server"]);
  });

  it("Windows가 아니면 codex app-server를 직접 실행한다", () => {
    const spec = getCodexAppServerProcessSpec("linux");

    expect(spec.command).toBe("codex");
    expect(spec.args).toEqual(["app-server"]);
  });
});

describe("Codex App Server initialization messages", () => {
  it("initialize 요청에 현재 Codex가 요구하는 clientInfo를 포함한다", () => {
    expect(getCodexInitializeRequest()).toEqual({
      id: 1,
      method: "initialize",
      params: {
        clientInfo: {
          name: "mycodex-usage-dashboard",
          version: "0.1.0"
        },
        capabilities: {}
      }
    });
  });

  it("initialized notification은 스키마의 method만 보낸다", () => {
    expect(getCodexInitializedNotification()).toEqual({
      method: "initialized"
    });
  });
});
