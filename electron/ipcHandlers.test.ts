import type { DashboardResponse } from "../shared/dashboardTypes.js";
import { createIpcHandlers } from "./ipcHandlers.js";

const okResponse: DashboardResponse = {
  generatedAt: "2026-06-26T00:00:00.000Z",
  status: "ok",
  today: { date: "2026-06-26", tokens: 10, costUsd: 0.1 },
  trend: [],
  limits: [
    {
      id: "codex",
      name: "Codex",
      planType: "pro",
      primary: { label: "5h", usedPercent: 1, resetsAt: null, windowDurationMins: 300 },
      secondary: { label: "1w", usedPercent: 2, resetsAt: null, windowDurationMins: 10080 }
    }
  ],
  sources: {
    ccusage: { ok: true, message: null, checkedAt: "2026-06-26T00:00:00.000Z" },
    codexAppServer: { ok: true, message: null, checkedAt: "2026-06-26T00:00:00.000Z" }
  }
};

function event(senderId: number, destroyed = false) {
  return { sender: { id: senderId, isDestroyed: () => destroyed } };
}

function harness(options: { shuttingDown?: boolean; response?: DashboardResponse; throws?: boolean } = {}) {
  const log = { write: vi.fn(() => Promise.resolve({ ok: true })) };
  const getDashboard = vi.fn(() =>
    options.throws ? Promise.reject(new Error("dashboard failed")) : Promise.resolve(options.response ?? okResponse)
  );
  const updateEditableSettings = vi.fn(() =>
    Promise.resolve({
      ok: true as const,
      settings: { panelAlphaPercent: 80, refreshIntervalSeconds: 10, showResetAsRemainingTime: true }
    })
  );
  const updateWindowPosition = vi.fn(() => Promise.resolve());
  const broadcastSettingsChanged = vi.fn();
  const kinds = new Map<number, "overlay" | "settings">([
    [1, "overlay"],
    [2, "settings"]
  ]);
  const handlers = createIpcHandlers({
    dashboardService: { getDashboard },
    settingsStore: {
      get: () => ({ panelAlphaPercent: 50, refreshIntervalSeconds: 5, showResetAsRemainingTime: false }),
      updateEditableSettings,
      updateWindowPosition
    },
    getSenderKind: (senderId) => kinds.get(senderId) ?? null,
    isShuttingDown: () => Boolean(options.shuttingDown),
    broadcastSettingsChanged,
    log,
    now: () => new Date("2026-06-26T00:00:00.000Z")
  });

  return { handlers, log, getDashboard, updateEditableSettings, updateWindowPosition, broadcastSettingsChanged };
}

describe("ipcHandlers", () => {
  it("정상 usage.getSnapshot은 dashboardService 결과를 반환하고 호출마다 새 조회를 한다", async () => {
    const h = harness();

    await expect(h.handlers.handleUsageGetSnapshot(event(1))).resolves.toEqual(okResponse);
    await expect(h.handlers.handleUsageGetSnapshot(event(1))).resolves.toEqual(okResponse);

    expect(h.getDashboard).toHaveBeenCalledTimes(2);
  });

  it("partial/error 응답은 완료 로그와 source별 실패 로그를 남기고 예외 로그는 남기지 않는다", async () => {
    const partial: DashboardResponse = {
      ...okResponse,
      status: "partial",
      today: null,
      sources: { ...okResponse.sources, ccusage: { ok: false, message: "token=abcd123456", checkedAt: okResponse.generatedAt } }
    };
    const h = harness({ response: partial });

    await h.handlers.handleUsageGetSnapshot(event(1));

    expect(h.log.write).toHaveBeenCalledWith("usage-completed", expect.any(Object));
    expect(h.log.write).toHaveBeenCalledWith("usage-source-failed", expect.objectContaining({ source: "ccusage" }));
    expect(h.log.write).not.toHaveBeenCalledWith("usage-exception", expect.any(Object));
  });

  it("dashboardService throw는 usage exception 로그를 남기고 reject한다", async () => {
    const h = harness({ throws: true });

    await expect(h.handlers.handleUsageGetSnapshot(event(1))).rejects.toThrow("dashboard failed");

    expect(h.log.write).toHaveBeenCalledWith("usage-exception", expect.any(Object));
  });

  it("settings sender 또는 unknown sender의 usage.getSnapshot은 조회를 시작하지 않는다", async () => {
    const h = harness();

    await expect(h.handlers.handleUsageGetSnapshot(event(2))).rejects.toThrow("sender");
    await expect(h.handlers.handleUsageGetSnapshot(event(99))).rejects.toThrow("sender");

    expect(h.getDashboard).not.toHaveBeenCalled();
  });

  it("shutdown 이후 usage.getSnapshot은 조회를 시작하지 않는다", async () => {
    const h = harness({ shuttingDown: true });

    await expect(h.handlers.handleUsageGetSnapshot(event(1))).rejects.toThrow("종료");

    expect(h.getDashboard).not.toHaveBeenCalled();
  });

  it("overlay와 settings sender 모두 settings.get을 호출할 수 있다", async () => {
    const h = harness();

    await expect(h.handlers.handleSettingsGet(event(1))).resolves.toEqual({
      panelAlphaPercent: 50,
      refreshIntervalSeconds: 5,
      showResetAsRemainingTime: false
    });
    await expect(h.handlers.handleSettingsGet(event(2))).resolves.toEqual({
      panelAlphaPercent: 50,
      refreshIntervalSeconds: 5,
      showResetAsRemainingTime: false
    });
  });

  it("settings.update는 settings sender만 저장하고 overlay에 changed 이벤트를 보낸다", async () => {
    const h = harness();

    const input = {
      panelAlphaPercent: 80,
      refreshIntervalSeconds: 10,
      showResetAsRemainingTime: true
    };

    await expect(h.handlers.handleSettingsUpdate(event(2), input)).resolves.toEqual({
      ok: true,
      settings: { panelAlphaPercent: 80, refreshIntervalSeconds: 10, showResetAsRemainingTime: true }
    });
    await expect(h.handlers.handleSettingsUpdate(event(1), input)).resolves.toMatchObject({
      ok: false,
      fieldErrors: {}
    });

    expect(h.updateEditableSettings).toHaveBeenCalledTimes(1);
    expect(h.updateEditableSettings).toHaveBeenCalledWith(input);
    expect(h.broadcastSettingsChanged).toHaveBeenCalledTimes(1);
  });

  it("destroyed sender는 민감 IPC에서 부수효과 없이 거부된다", async () => {
    const h = harness();

    await expect(h.handlers.handleSettingsGet(event(1, true))).rejects.toThrow("sender");
    await expect(h.handlers.handleSettingsUpdate(event(1, true), {})).resolves.toMatchObject({ ok: false, fieldErrors: {} });

    expect(h.updateEditableSettings).not.toHaveBeenCalled();
    expect(h.broadcastSettingsChanged).not.toHaveBeenCalled();
  });

  it("shutdown 이후 settings.update와 updateWindowPosition은 저장과 event를 수행하지 않는다", async () => {
    const h = harness({ shuttingDown: true });

    await expect(
      h.handlers.handleSettingsUpdate(event(2), {
        panelAlphaPercent: 80,
        refreshIntervalSeconds: 10,
        showResetAsRemainingTime: true
      })
    ).resolves.toMatchObject({ ok: false, fieldErrors: {} });
    await h.handlers.updateWindowPosition({ x: 1, y: 2 });

    expect(h.updateEditableSettings).not.toHaveBeenCalled();
    expect(h.updateWindowPosition).not.toHaveBeenCalled();
    expect(h.broadcastSettingsChanged).not.toHaveBeenCalled();
  });
});
