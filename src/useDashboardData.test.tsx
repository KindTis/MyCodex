import { renderHook, act } from "@testing-library/react";
import { useDashboardData } from "./useDashboardData";
import type { DashboardResponse } from "./api";

const dashboard: DashboardResponse = {
  generatedAt: "2026-06-26T00:00:00.000Z",
  status: "ok",
  today: { date: "2026-06-26", tokens: 10, costUsd: 0.01 },
  trend: [],
  limits: [],
  sources: {
    ccusage: { ok: true, message: null, checkedAt: "2026-06-26T00:00:00.000Z" },
    codexAppServer: { ok: true, message: null, checkedAt: "2026-06-26T00:00:00.000Z" }
  }
};

function mockFetch(data = dashboard) {
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data)
  } as Response);
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useDashboardData", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("mount 직후 데이터를 조회한다", async () => {
    mockFetch();
    const { result } = renderHook(() => useDashboardData());

    expect(fetch).toHaveBeenCalledWith("/api/dashboard");
    await flushPromises();
    expect(result.current.data).toEqual(dashboard);
  });

  it("60초 뒤 자동 갱신한다", async () => {
    mockFetch();
    renderHook(() => useDashboardData());
    await flushPromises();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    await flushPromises();

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("진행 중 refresh 중복 호출을 막는다", async () => {
    let resolveFetch: (value: Response) => void = () => undefined;
    vi.mocked(fetch).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    const { result } = renderHook(() => useDashboardData());

    act(() => {
      void result.current.refresh();
      void result.current.refresh();
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveFetch({ ok: true, json: () => Promise.resolve(dashboard) } as Response);
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it("다음 자동 갱신 countdown을 1초 단위로 줄인다", async () => {
    mockFetch();
    const { result } = renderHook(() => useDashboardData());
    await flushPromises();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.nextRefreshInSeconds).toBe(59);
  });
});
