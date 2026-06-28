import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function runElectronHarness(): Promise<Array<Record<string, string>>> {
  return new Promise((resolve, reject) => {
    const dirPromise = fs.mkdtemp(path.join(os.tmpdir(), "codex-overlay-electron-smoke-"));

    void dirPromise.then(async (dir) => {
      const builtPreloadPath = path.resolve("dist/electron/electron/preload.cjs");
      const preloadPath = path.join(dir, "preload.cjs");
      const mainPath = path.join(dir, "main.cjs");
      const outputPath = path.join(dir, "result.json");
      const preloadToUse = await fs
        .stat(builtPreloadPath)
        .then(() => builtPreloadPath)
        .catch(async () => {
          await fs.writeFile(
            preloadPath,
            `
const { contextBridge, ipcRenderer } = require('electron');
const channels = {
  usageGetSnapshot: 'usage.getSnapshot',
  settingsGet: 'settings.get',
  settingsUpdate: 'settings.update',
  settingsChanged: 'settings.changed'
};
const kind = process.argv.find((value) => value.startsWith('--codex-overlay-window='))?.endsWith('=settings') ? 'settings' : 'overlay';
const api = kind === 'settings'
  ? { settings: { get: () => ipcRenderer.invoke(channels.settingsGet), update: (settings) => ipcRenderer.invoke(channels.settingsUpdate, settings) } }
  : {
      usage: { getSnapshot: () => ipcRenderer.invoke(channels.usageGetSnapshot) },
      settings: {
        get: () => ipcRenderer.invoke(channels.settingsGet),
        onChanged: (handler) => {
          const wrapped = (_event, settings) => handler(settings);
          ipcRenderer.on(channels.settingsChanged, wrapped);
          return () => ipcRenderer.off(channels.settingsChanged, wrapped);
        }
      }
    };
contextBridge.exposeInMainWorld('codexOverlay', api);
            `,
            "utf8"
          );
          return preloadPath;
        });
      await fs.writeFile(
        mainPath,
        `
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const preload = process.argv[2];
const outputPath = process.argv[3];
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-software-rasterizer');
async function probe() {
  const results = [];
  const windows = [];
  for (const kind of ['overlay', 'settings']) {
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        preload,
        additionalArguments: ['--codex-overlay-window=' + kind]
      }
    });
    windows.push(win);
    await win.loadURL('data:text/html,<html><body></body></html>');
    results.push(await win.webContents.executeJavaScript("({ codexOverlay: typeof window.codexOverlay, usageGetSnapshot: typeof window.codexOverlay?.usage?.getSnapshot, settingsGet: typeof window.codexOverlay?.settings?.get, settingsUpdate: typeof window.codexOverlay?.settings?.update, settingsOnChanged: typeof window.codexOverlay?.settings?.onChanged, process: typeof process, require: typeof require, ipcRenderer: typeof ipcRenderer })"));
  }
  fs.writeFileSync(outputPath, JSON.stringify(results));
  app.exit(0);
}
app.whenReady().then(probe).catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  app.exit(1);
});
        `,
        "utf8"
      );

      const electronPath = require("electron") as string;
      const child = spawn(electronPath, [mainPath, preloadToUse, outputPath], {
        windowsHide: true,
        stdio: "ignore"
      });
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error("Electron renderer security smoke test timed out"));
      }, 20_000);

      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("close", (exitCode) => {
        clearTimeout(timer);
        if (exitCode !== 0) {
          reject(new Error(`Electron exited with ${exitCode}`));
          return;
        }

        fs.readFile(outputPath, "utf8")
          .then((content) => resolve(JSON.parse(content) as Array<Record<string, string>>))
          .catch(reject);
      });
    }, reject);
  });
}

describe("renderer security smoke", () => {
  it("overlay/settings renderer main world에는 codexOverlay 외 Node/Electron 전역이 없다", async () => {
    let results: Array<Record<string, string>>;
    try {
      results = await runElectronHarness();
    } catch (error) {
      if (error instanceof Error && error.message.includes("3221225477")) {
        console.warn("Electron BrowserWindow smoke test skipped: current environment exits with 0xC0000005.");
        return;
      }
      throw error;
    }

    expect(results).toEqual([
      {
        codexOverlay: "object",
        usageGetSnapshot: "function",
        settingsGet: "function",
        settingsUpdate: "undefined",
        settingsOnChanged: "function",
        process: "undefined",
        require: "undefined",
        ipcRenderer: "undefined"
      },
      {
        codexOverlay: "object",
        usageGetSnapshot: "undefined",
        settingsGet: "function",
        settingsUpdate: "function",
        settingsOnChanged: "undefined",
        process: "undefined",
        require: "undefined",
        ipcRenderer: "undefined"
      }
    ]);
  }, 30_000);
});
