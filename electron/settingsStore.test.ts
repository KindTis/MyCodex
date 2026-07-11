import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createSettingsStore } from "./settingsStore.js";

async function tempSettingsPath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-overlay-settings-"));
  return path.join(dir, "settings.json");
}

describe("settingsStore", () => {
  it("설정 파일이 없으면 기본 설정을 반환한다", async () => {
    const store = createSettingsStore({ settingsPath: await tempSettingsPath() });

    await expect(store.load()).resolves.toEqual({
      panelAlphaPercent: 50,
      refreshIntervalSeconds: 30,
      showResetAsRemainingTime: false
    });
  });

  it("정상 JSON은 그대로 반환한다", async () => {
    const settingsPath = await tempSettingsPath();
    await fs.writeFile(
      settingsPath,
      JSON.stringify({ panelAlphaPercent: 80, refreshIntervalSeconds: 30, showResetAsRemainingTime: true }),
      "utf8"
    );
    const store = createSettingsStore({ settingsPath });

    await expect(store.load()).resolves.toEqual({
      panelAlphaPercent: 80,
      refreshIntervalSeconds: 30,
      showResetAsRemainingTime: true
    });
  });

  it("새 필드가 없는 기존 설정 파일은 상대 시간 표시를 비활성화한다", async () => {
    const settingsPath = await tempSettingsPath();
    await fs.writeFile(settingsPath, JSON.stringify({ panelAlphaPercent: 80, refreshIntervalSeconds: 30 }), "utf8");
    const store = createSettingsStore({ settingsPath });

    await expect(store.load()).resolves.toEqual({
      panelAlphaPercent: 80,
      refreshIntervalSeconds: 30,
      showResetAsRemainingTime: false
    });
  });

  it("잘못된 상대 시간 표시 저장값은 false로 보정한다", async () => {
    const settingsPath = await tempSettingsPath();
    await fs.writeFile(
      settingsPath,
      JSON.stringify({
        panelAlphaPercent: 70,
        refreshIntervalSeconds: 20,
        showResetAsRemainingTime: "true"
      }),
      "utf8"
    );
    const store = createSettingsStore({ settingsPath });

    await expect(store.load()).resolves.toEqual({
      panelAlphaPercent: 70,
      refreshIntervalSeconds: 20,
      showResetAsRemainingTime: false
    });
    expect(JSON.parse(await fs.readFile(settingsPath, "utf8"))).toEqual({
      panelAlphaPercent: 70,
      refreshIntervalSeconds: 20,
      showResetAsRemainingTime: false
    });
  });

  it("상대 시간 표시 설정을 저장하고 새 store에서 복원한다", async () => {
    const settingsPath = await tempSettingsPath();
    const firstStore = createSettingsStore({ settingsPath });
    await firstStore.load();

    await expect(
      firstStore.updateEditableSettings({
        panelAlphaPercent: 80,
        refreshIntervalSeconds: 15,
        showResetAsRemainingTime: true
      })
    ).resolves.toMatchObject({ ok: true, settings: { showResetAsRemainingTime: true } });

    const secondStore = createSettingsStore({ settingsPath });
    await expect(secondStore.load()).resolves.toMatchObject({ showResetAsRemainingTime: true });
  });

  it("일부 필드가 범위 밖이면 해당 필드만 기본값으로 보정하고 정상 필드는 보존한다", async () => {
    const settingsPath = await tempSettingsPath();
    await fs.writeFile(settingsPath, JSON.stringify({ panelAlphaPercent: 10, refreshIntervalSeconds: 30 }), "utf8");
    const store = createSettingsStore({ settingsPath });

    await expect(store.load()).resolves.toEqual({
      panelAlphaPercent: 50,
      refreshIntervalSeconds: 30,
      showResetAsRemainingTime: false
    });
    expect(JSON.parse(await fs.readFile(settingsPath, "utf8"))).toEqual({
      panelAlphaPercent: 50,
      refreshIntervalSeconds: 30,
      showResetAsRemainingTime: false
    });
  });

  it("malformed windowPosition만 제거하고 다른 정상 필드는 보존한다", async () => {
    const settingsPath = await tempSettingsPath();
    await fs.writeFile(
      settingsPath,
      JSON.stringify({ panelAlphaPercent: 70, refreshIntervalSeconds: 20, windowPosition: { x: "bad", y: 1 } }),
      "utf8"
    );
    const store = createSettingsStore({ settingsPath });

    await expect(store.load()).resolves.toEqual({
      panelAlphaPercent: 70,
      refreshIntervalSeconds: 20,
      showResetAsRemainingTime: false
    });
  });

  it("malformed JSON은 전체 기본 설정으로 대체 저장한다", async () => {
    const settingsPath = await tempSettingsPath();
    await fs.writeFile(settingsPath, "{bad", "utf8");
    const store = createSettingsStore({ settingsPath });

    await expect(store.load()).resolves.toEqual({
      panelAlphaPercent: 50,
      refreshIntervalSeconds: 30,
      showResetAsRemainingTime: false
    });
    expect(JSON.parse(await fs.readFile(settingsPath, "utf8"))).toEqual({
      panelAlphaPercent: 50,
      refreshIntervalSeconds: 30,
      showResetAsRemainingTime: false
    });
  });

  it("normalization write 실패 시 보정된 in-memory 설정을 반환하고 changed event는 발생하지 않는다", async () => {
    const changed = vi.fn();
    const store = createSettingsStore({
      settingsPath: "C:/tmp/settings.json",
      fsImpl: {
        readFile: vi.fn(() => Promise.resolve(JSON.stringify({ panelAlphaPercent: 10, refreshIntervalSeconds: 40 }))),
        mkdir: vi.fn(() => Promise.resolve(undefined)),
        writeFile: vi.fn(() => Promise.reject(new Error("write failed")))
      } as never
    });
    store.onChanged(changed);

    await expect(store.load()).resolves.toEqual({
      panelAlphaPercent: 50,
      refreshIntervalSeconds: 40,
      showResetAsRemainingTime: false
    });
    expect(changed).not.toHaveBeenCalled();
  });

  it.each([
    { panelAlphaPercent: "50", refreshIntervalSeconds: 5, showResetAsRemainingTime: false },
    { panelAlphaPercent: Number.NaN, refreshIntervalSeconds: 5, showResetAsRemainingTime: false },
    { panelAlphaPercent: 50, refreshIntervalSeconds: Infinity, showResetAsRemainingTime: false },
    { panelAlphaPercent: 50, refreshIntervalSeconds: 5, showResetAsRemainingTime: "true" },
    { panelAlphaPercent: 50, refreshIntervalSeconds: 5 }
  ])("잘못된 settings.update 입력을 fieldErrors로 거부한다", async (input) => {
    const store = createSettingsStore({ settingsPath: await tempSettingsPath() });
    await store.load();

    const result = await store.updateEditableSettings(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.fieldErrors).length).toBeGreaterThan(0);
    }
  });

  it("plain object가 아니거나 extra field를 포함하면 formError로 거부한다", async () => {
    const store = createSettingsStore({ settingsPath: await tempSettingsPath() });
    await store.load();

    await expect(store.updateEditableSettings(null)).resolves.toMatchObject({ ok: false, fieldErrors: {} });
    await expect(
      store.updateEditableSettings({
        panelAlphaPercent: 50,
        refreshIntervalSeconds: 5,
        showResetAsRemainingTime: false,
        extra: true
      })
    ).resolves.toMatchObject({ ok: false, fieldErrors: {} });
  });

  it("사용자 설정 파일 write 실패는 in-memory commit 없이 실패 결과를 반환한다", async () => {
    const store = createSettingsStore({
      settingsPath: "C:/tmp/settings.json",
      fsImpl: {
        readFile: vi.fn(() => Promise.reject(Object.assign(new Error("missing"), { code: "ENOENT" }))),
        mkdir: vi.fn(() => Promise.resolve(undefined)),
        writeFile: vi.fn(() => Promise.reject(new Error("write failed")))
      } as never
    });
    await store.load();

    await expect(
      store.updateEditableSettings({
        panelAlphaPercent: 80,
        refreshIntervalSeconds: 10,
        showResetAsRemainingTime: true
      })
    ).resolves.toMatchObject({ ok: false });
    expect(store.get()).toEqual({
      panelAlphaPercent: 50,
      refreshIntervalSeconds: 30,
      showResetAsRemainingTime: false
    });
  });

  it("정상 저장은 기존 windowPosition을 보존하고 changed event를 보낸다", async () => {
    const store = createSettingsStore({ settingsPath: await tempSettingsPath() });
    const changed = vi.fn();
    await store.load();
    await store.updateWindowPosition({ x: 10, y: 20 });
    store.onChanged(changed);

    const result = await store.updateEditableSettings({
      panelAlphaPercent: 80,
      refreshIntervalSeconds: 15,
      showResetAsRemainingTime: true
    });

    expect(result).toEqual({
      ok: true,
      settings: {
        panelAlphaPercent: 80,
        refreshIntervalSeconds: 15,
        showResetAsRemainingTime: true,
        windowPosition: { x: 10, y: 20 }
      }
    });
    expect(changed).toHaveBeenCalledWith({
      panelAlphaPercent: 80,
      refreshIntervalSeconds: 15,
      showResetAsRemainingTime: true,
      windowPosition: { x: 10, y: 20 }
    });
  });

  it("창 위치 저장은 changed event를 발행하지 않고 write 실패 시 in-memory 위치를 유지한다", async () => {
    const changed = vi.fn();
    const store = createSettingsStore({
      settingsPath: "C:/tmp/settings.json",
      fsImpl: {
        readFile: vi.fn(() => Promise.reject(Object.assign(new Error("missing"), { code: "ENOENT" }))),
        mkdir: vi.fn(() => Promise.resolve(undefined)),
        writeFile: vi.fn(() => Promise.reject(new Error("write failed")))
      } as never
    });
    await store.load();
    store.onChanged(changed);

    await store.updateWindowPosition({ x: 5, y: 6 });

    expect(changed).not.toHaveBeenCalled();
    expect(store.get()).toEqual({
      panelAlphaPercent: 50,
      refreshIntervalSeconds: 30,
      showResetAsRemainingTime: false,
      windowPosition: { x: 5, y: 6 }
    });
  });

  it("beginShutdown 이후 update와 일반 위치 저장을 거부한다", async () => {
    const store = createSettingsStore({ settingsPath: await tempSettingsPath() });
    const changed = vi.fn();
    await store.load();
    store.onChanged(changed);

    await store.beginShutdown({ x: 1, y: 2 });
    await store.updateWindowPosition({ x: 3, y: 4 });
    const result = await store.updateEditableSettings({
      panelAlphaPercent: 80,
      refreshIntervalSeconds: 10,
      showResetAsRemainingTime: true
    });

    expect(result).toMatchObject({ ok: false, fieldErrors: {} });
    expect(changed).not.toHaveBeenCalled();
    expect(store.get().windowPosition).toEqual({ x: 1, y: 2 });
  });
});
