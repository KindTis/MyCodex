import { act, render, screen, waitFor } from "@testing-library/react";
import type { DashboardResponse } from "../../shared/dashboardTypes";
import { OverlayApp } from "./OverlayApp";

const response: DashboardResponse = {
  generatedAt: "2026-06-26T00:00:00.000Z",
  status: "ok",
  today: { date: "2026-06-26", tokens: 1000, costUsd: 0.1234 },
  trend: [],
  limits: [
    {
      id: "codex",
      name: "Codex",
      planType: "pro",
      primary: { label: "5h", usedPercent: 12, resetsAt: "2026-07-11T14:30:00.000Z", windowDurationMins: 300 },
      secondary: { label: "1w", usedPercent: 3, resetsAt: "2026-07-18T03:05:00.000Z", windowDurationMins: 10080 }
    }
  ],
  sources: {
    ccusage: { ok: true, message: null, checkedAt: "2026-06-26T00:00:00.000Z" },
    codexAppServer: { ok: true, message: null, checkedAt: "2026-06-26T00:00:00.000Z" }
  }
};

function installOverlayApi(options: {
  settingsGet?: ReturnType<typeof vi.fn>;
  getSnapshot?: ReturnType<typeof vi.fn>;
  onChanged?: ReturnType<typeof vi.fn>;
} = {}) {
  const unsubscribe = vi.fn();
  const settingsGet =
    options.settingsGet ?? vi.fn(() => Promise.resolve({ panelAlphaPercent: 80, refreshIntervalSeconds: 10 }));
  const getSnapshot = options.getSnapshot ?? vi.fn(() => Promise.resolve(response));
  const onChanged = options.onChanged ?? vi.fn(() => unsubscribe);
  window.codexOverlay = {
    usage: { getSnapshot },
    settings: { get: settingsGet, onChanged }
  };
  return { settingsGet, getSnapshot, onChanged, unsubscribe };
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("OverlayApp", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete window.codexOverlay;
  });

  it("mount 직후 settings.get과 usage.getSnapshot을 호출하고 저장 설정을 반영한다", async () => {
    const api = installOverlayApi();

    render(<OverlayApp />);

    expect(api.settingsGet).toHaveBeenCalledTimes(1);
    expect(api.getSnapshot).toHaveBeenCalledTimes(1);
    await flushPromises();
    expect(screen.getByText("1,000")).toBeTruthy();
    expect(screen.getByText("CODEX USAGE").closest("main")?.style.getPropertyValue("--panel-alpha")).toBe("0.8");
  });

  it("5H와 1W limit 행에 로컬 reset 날짜와 시간을 표시한다", async () => {
    installOverlayApi();

    render(<OverlayApp />);
    await flushPromises();

    expect(screen.getByRole("progressbar", { name: "5H LIMIT" }).closest(".limit-row")?.textContent).toContain(
      "5H LIMIT (RESET 7/11 23:30)"
    );
    expect(screen.getByRole("progressbar", { name: "1W LIMIT" }).closest(".limit-row")?.textContent).toContain(
      "1W LIMIT (RESET 7/18 12:05)"
    );
  });

  it("저장된 refreshIntervalSeconds가 첫 polling interval 생성에 사용된다", async () => {
    const api = installOverlayApi();
    render(<OverlayApp />);
    await flushPromises();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9_999);
    });
    expect(api.getSnapshot).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(api.getSnapshot).toHaveBeenCalledTimes(2);
  });

  it("settings.get 실패 시 기본 설정으로 fallback하고 30초 polling을 시작한다", async () => {
    const api = installOverlayApi({ settingsGet: vi.fn(() => Promise.reject(new Error("failed"))) });
    render(<OverlayApp />);
    await flushPromises();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(api.getSnapshot).toHaveBeenCalledTimes(2);
    expect(screen.getByText("CODEX USAGE").closest("main")?.style.getPropertyValue("--panel-alpha")).toBe("0.5");
  });

  it("진행 중인 조회가 끝나지 않았을 때 timer tick이 와도 두 번째 조회를 시작하지 않는다", async () => {
    let resolveSnapshot: (value: DashboardResponse) => void = () => undefined;
    const getSnapshot = vi.fn(
      () =>
        new Promise<DashboardResponse>((resolve) => {
          resolveSnapshot = resolve;
        })
    );
    const api = installOverlayApi({ getSnapshot });
    render(<OverlayApp />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(api.getSnapshot).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSnapshot(response);
    });
  });

  it("settings.changed payload를 받으면 settings.get 재호출 없이 alpha와 interval을 바꾼다", async () => {
    let handler: (settings: { panelAlphaPercent: number; refreshIntervalSeconds: number }) => void = () => undefined;
    const api = installOverlayApi({
      onChanged: vi.fn((nextHandler) => {
        handler = nextHandler;
        return vi.fn();
      })
    });
    render(<OverlayApp />);
    await flushPromises();

    act(() => {
      handler({ panelAlphaPercent: 60, refreshIntervalSeconds: 6 });
    });

    expect(api.settingsGet).toHaveBeenCalledTimes(1);
    expect(screen.getByText("CODEX USAGE").closest("main")?.style.getPropertyValue("--panel-alpha")).toBe("0.6");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_000);
    });
    expect(api.getSnapshot).toHaveBeenCalledTimes(2);
  });

  it("unmount 후 interval과 settings listener를 정리하고 늦은 snapshot을 무시한다", async () => {
    let resolveSnapshot: (value: DashboardResponse) => void = () => undefined;
    const getSnapshot = vi.fn(
      () =>
        new Promise<DashboardResponse>((resolve) => {
          resolveSnapshot = resolve;
        })
    );
    const api = installOverlayApi({ getSnapshot });

    const rendered = render(<OverlayApp />);
    rendered.unmount();
    await act(async () => {
      resolveSnapshot(response);
      await vi.advanceTimersByTimeAsync(20_000);
    });

    expect(api.unsubscribe).toHaveBeenCalledTimes(1);
    expect(api.getSnapshot).toHaveBeenCalledTimes(1);
  });

  it("usage.getSnapshot 예외는 exception view model을 표시한다", async () => {
    installOverlayApi({ getSnapshot: vi.fn(() => Promise.reject(new Error("failed"))) });

    render(<OverlayApp />);

    await flushPromises();
    expect(screen.getAllByText("--").length).toBeGreaterThan(0);
    expect(screen.getByText("CODEX USAGE").closest("main")?.className).toContain("tone-fail");
  });
});
