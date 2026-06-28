import type { ChildProcess } from "node:child_process";

export type ChildTracker = ReturnType<typeof createChildTracker>;

export type ChildCleanupResult = {
  attempted: number;
  remaining: number;
  timedOut: boolean;
};

function waitForExit(child: ChildProcess, timeoutMs: number): Promise<"closed" | "error" | "timeout"> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: "closed" | "error" | "timeout") => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      child.off("close", onClose);
      child.off("error", onError);
      resolve(result);
    };
    const onClose = () => finish("closed");
    const onError = () => finish("error");
    const timer = setTimeout(() => finish("timeout"), timeoutMs);

    child.once("close", onClose);
    child.once("error", onError);
  });
}

export function createChildTracker() {
  const active = new Set<ChildProcess>();

  function track(child: ChildProcess): ChildProcess {
    active.add(child);
    const remove = () => {
      active.delete(child);
    };
    child.once("close", remove);
    child.once("error", remove);
    return child;
  }

  async function cleanup(options: { timeoutMs?: number } = {}): Promise<ChildCleanupResult> {
    const timeoutMs = options.timeoutMs ?? 2_000;
    const children = [...active];

    for (const child of children) {
      if (!child.killed) {
        child.kill();
      }
    }

    const results = await Promise.all(children.map((child) => waitForExit(child, timeoutMs)));

    return {
      attempted: children.length,
      remaining: active.size,
      timedOut: results.includes("timeout")
    };
  }

  function size(): number {
    return active.size;
  }

  return {
    track,
    cleanup,
    size
  };
}
