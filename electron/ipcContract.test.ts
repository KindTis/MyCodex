import { IPC_CHANNELS } from "./ipcContract.js";

describe("IPC_CHANNELS", () => {
  it("허용된 IPC channel만 정의한다", () => {
    expect(IPC_CHANNELS).toEqual({
      usageGetSnapshot: "usage.getSnapshot",
      settingsGet: "settings.get",
      settingsUpdate: "settings.update",
      settingsChanged: "settings.changed"
    });
    expect(Object.values(IPC_CHANNELS)).not.toContain("openSettings");
    expect(Object.values(IPC_CHANNELS)).not.toContain("quit");
    expect(Object.values(IPC_CHANNELS)).not.toContain("close");
  });
});
