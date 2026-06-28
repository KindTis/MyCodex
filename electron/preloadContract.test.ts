import { createCodexOverlayApi, getPreloadWindowKind } from "./preloadContract.js";

function ipcMock() {
  return {
    invoke: vi.fn(() => Promise.resolve(null)),
    on: vi.fn(),
    off: vi.fn()
  };
}

describe("preloadContract", () => {
  it("overlay kind는 usage.getSnapshot, settings.get, settings.onChanged만 제공한다", () => {
    const api = createCodexOverlayApi("overlay", ipcMock()) as Record<string, any>;

    expect(typeof api.usage.getSnapshot).toBe("function");
    expect(typeof api.settings.get).toBe("function");
    expect(typeof api.settings.onChanged).toBe("function");
    expect(api.settings.update).toBeUndefined();
    expect(api.openSettings).toBeUndefined();
    expect(api.quit).toBeUndefined();
    expect(api.close).toBeUndefined();
  });

  it("settings kind는 settings.get과 settings.update만 제공한다", () => {
    const api = createCodexOverlayApi("settings", ipcMock()) as Record<string, any>;

    expect(api.usage).toBeUndefined();
    expect(typeof api.settings.get).toBe("function");
    expect(typeof api.settings.update).toBe("function");
    expect(api.settings.onChanged).toBeUndefined();
    expect(api.openSettings).toBeUndefined();
    expect(api.quit).toBeUndefined();
    expect(api.close).toBeUndefined();
  });

  it("settings.onChanged는 unsubscribe를 반환한다", () => {
    const ipc = ipcMock();
    const api = createCodexOverlayApi("overlay", ipc) as Record<string, any>;

    const unsubscribe = api.settings.onChanged(vi.fn());
    unsubscribe();

    expect(ipc.on).toHaveBeenCalledWith("settings.changed", expect.any(Function));
    expect(ipc.off).toHaveBeenCalledWith("settings.changed", expect.any(Function));
  });

  it("argv에서 window kind를 읽는다", () => {
    expect(getPreloadWindowKind(["electron", "--codex-overlay-window=settings"])).toBe("settings");
    expect(getPreloadWindowKind(["electron", "--codex-overlay-window=overlay"])).toBe("overlay");
  });
});
