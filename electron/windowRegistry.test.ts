import { EventEmitter } from "node:events";
import { registerWindowKind, type RegistryWindowLike } from "./windowRegistry.js";

function destroyedOnClosedWindow(id: number): RegistryWindowLike & EventEmitter {
  let destroyed = false;
  const emitter = new EventEmitter() as RegistryWindowLike & EventEmitter;
  Object.defineProperty(emitter, "webContents", {
    get() {
      if (destroyed) {
        throw new Error("Object has been destroyed");
      }
      return { id };
    }
  });
  emitter.once("closed", () => {
    destroyed = true;
  });
  return emitter;
}

describe("windowRegistry", () => {
  it("closed 이벤트에서는 이미 파괴된 webContents를 다시 읽지 않는다", () => {
    const senderKinds = new Map<number, "overlay" | "settings">();
    const window = destroyedOnClosedWindow(42);

    registerWindowKind(senderKinds, window, "overlay");

    expect(senderKinds.get(42)).toBe("overlay");
    expect(() => window.emit("closed")).not.toThrow();
    expect(senderKinds.has(42)).toBe(false);
  });
});
