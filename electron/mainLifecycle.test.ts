import { EventEmitter } from "node:events";
import { createMainLifecycle, type LifecycleWindow } from "./mainLifecycle.js";

function windowMock(bounds = { x: 1, y: 2 }): LifecycleWindow & EventEmitter {
  const emitter = new EventEmitter() as LifecycleWindow & EventEmitter;
  emitter.show = vi.fn();
  emitter.focus = vi.fn();
  emitter.getBounds = vi.fn(() => bounds);
  return emitter;
}

function harness(lock = true) {
  let secondInstanceHandler: (() => void) | null = null;
  const overlay = windowMock();
  const settings = windowMock();
  const settingsStore = {
    updateWindowPosition: vi.fn(() => Promise.resolve()),
    beginShutdown: vi.fn(() => Promise.resolve())
  };
  const lifecycle = createMainLifecycle({
    requestSingleInstanceLock: vi.fn(() => lock),
    quit: vi.fn(),
    onSecondInstance: (handler) => {
      secondInstanceHandler = handler;
    },
    createOverlayWindow: vi.fn(() => overlay),
    createSettingsWindow: vi.fn(() => settings),
    settingsStore,
    childTracker: { cleanup: vi.fn(() => Promise.resolve()) },
    setTimeoutFn: setTimeout,
    clearTimeoutFn: clearTimeout
  });

  return { lifecycle, overlay, settings, settingsStore, secondInstance: () => secondInstanceHandler?.() };
}

describe("mainLifecycle", () => {
  it("single instance lock 실패 시 window와 service를 만들지 않고 quit한다", () => {
    const requestSingleInstanceLock = vi.fn(() => false);
    const quit = vi.fn();
    const createOverlayWindow = vi.fn(() => windowMock());
    const lifecycle = createMainLifecycle({
      requestSingleInstanceLock,
      quit,
      onSecondInstance: vi.fn(),
      createOverlayWindow,
      createSettingsWindow: vi.fn(() => windowMock()),
      settingsStore: { updateWindowPosition: vi.fn(), beginShutdown: vi.fn() }
    });

    expect(lifecycle.start()).toBe(false);
    expect(createOverlayWindow).not.toHaveBeenCalled();
    expect(quit).toHaveBeenCalledTimes(1);
  });

  it("second-instance는 기존 overlay만 show/focus한다", () => {
    const h = harness();
    h.lifecycle.start();

    h.secondInstance();

    expect(h.overlay.show).toHaveBeenCalledTimes(1);
    expect(h.overlay.focus).toHaveBeenCalledTimes(1);
  });

  it("settings window는 singleton으로 관리한다", () => {
    const h = harness();
    h.lifecycle.start();

    h.lifecycle.openSettings();
    h.lifecycle.openSettings();

    expect(h.settings.show).toHaveBeenCalledTimes(1);
    expect(h.settings.focus).toHaveBeenCalledTimes(1);
    h.settings.emit("closed");
    h.lifecycle.openSettings();
    expect(h.lifecycle.getSettingsWindow()).toBe(h.settings);
  });

  it("연속 move 이벤트는 500ms 뒤 마지막 위치만 저장하고 shutdown은 debounce를 취소한다", async () => {
    vi.useFakeTimers();
    const h = harness();
    h.lifecycle.start();

    h.overlay.emit("move");
    h.overlay.emit("moved");
    await vi.advanceTimersByTimeAsync(499);
    expect(h.settingsStore.updateWindowPosition).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(h.settingsStore.updateWindowPosition).toHaveBeenCalledWith({ x: 1, y: 2 });

    h.overlay.emit("move");
    await h.lifecycle.beginShutdown();
    await vi.advanceTimersByTimeAsync(500);
    expect(h.settingsStore.updateWindowPosition).toHaveBeenCalledTimes(1);
    expect(h.settingsStore.beginShutdown).toHaveBeenCalledWith({ x: 1, y: 2 });
    vi.useRealTimers();
  });
});
