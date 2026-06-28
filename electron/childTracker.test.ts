import { EventEmitter } from "node:events";
import { createChildTracker } from "./childTracker.js";

function childMock() {
  const events = new EventEmitter();
  const child = events as EventEmitter & { killed: boolean; kill: ReturnType<typeof vi.fn> };
  child.killed = false;
  child.kill = vi.fn(() => {
    child.killed = true;
    return true;
  });
  child.off = events.off.bind(events);
  child.once = events.once.bind(events);
  return child;
}

describe("childTracker", () => {
  it("완료된 child를 active set에서 제거한다", () => {
    const tracker = createChildTracker();
    const child = childMock();

    tracker.track(child as never);
    expect(tracker.size()).toBe(1);
    child.emit("close");

    expect(tracker.size()).toBe(0);
  });

  it("cleanup은 active child를 kill하고 close를 기다린다", async () => {
    const tracker = createChildTracker();
    const child = childMock();
    tracker.track(child as never);

    const cleanup = tracker.cleanup({ timeoutMs: 100 });
    expect(child.kill).toHaveBeenCalledTimes(1);
    child.emit("close");

    await expect(cleanup).resolves.toEqual({ attempted: 1, remaining: 0, timedOut: false });
  });

  it("cleanup timeout은 결과에 남긴다", async () => {
    vi.useFakeTimers();
    const tracker = createChildTracker();
    const child = childMock();
    tracker.track(child as never);

    const cleanup = tracker.cleanup({ timeoutMs: 50 });
    await vi.advanceTimersByTimeAsync(50);

    await expect(cleanup).resolves.toEqual({ attempted: 1, remaining: 1, timedOut: true });
    vi.useRealTimers();
  });
});
