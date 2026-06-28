import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createDashboardServerController } from "./dashboardServer.js";
import type { DashboardResponse, DebugResponse } from "../server/data/types.js";

const dashboard: DashboardResponse = {
  generatedAt: "2026-06-26T00:00:00.000Z",
  status: "ok",
  today: { date: "2026-06-26", tokens: 100, costUsd: 0.1 },
  trend: [],
  limits: [],
  sources: {
    ccusage: { ok: true, message: null, checkedAt: "2026-06-26T00:00:00.000Z" },
    codexAppServer: { ok: true, message: null, checkedAt: "2026-06-26T00:00:00.000Z" }
  }
};

const debug: DebugResponse = {
  generatedAt: "2026-06-26T00:00:00.000Z",
  ccusage: {
    ok: true,
    lastSuccessAt: "2026-06-26T00:00:00.000Z",
    lastFailureAt: null,
    summary: {
      rows: 1,
      todayMatched: true,
      costField: "totalCost",
      sevenDayTokens: 100,
      sevenDayCostUsd: 0.1
    }
  },
  codexAppServer: {
    ok: true,
    lastSuccessAt: "2026-06-26T00:00:00.000Z",
    lastFailureAt: null,
    summary: {
      bucketIds: ["codex"],
      hasCodexBucket: true,
      primaryWindowDurationMins: 300,
      secondaryWindowDurationMins: 10080,
      primaryUsedPercent: 1,
      secondaryUsedPercent: 2
    }
  },
  errors: []
};

describe("dashboardServer", () => {
  it("기존 웹 대시보드를 127.0.0.1 임시 포트로 서빙한다", async () => {
    const clientDir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-dashboard-server-"));
    await fs.writeFile(path.join(clientDir, "index.html"), "<html><body>dashboard shell</body></html>", "utf8");
    const controller = createDashboardServerController({
      clientDir,
      service: {
        getDashboard: () => Promise.resolve(dashboard),
        getDebug: () => debug
      }
    });

    const url = await controller.ensureStarted();
    const page = await fetch(`${url}/dashboard`);
    const api = await fetch(`${url}/api/dashboard`);

    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(page.ok).toBe(true);
    expect(await page.text()).toContain("dashboard shell");
    expect(await api.json()).toEqual(dashboard);

    await controller.close();
  });

  it("이미 시작된 서버는 재사용하고 close 후에는 다시 시작할 수 있다", async () => {
    const clientDir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-dashboard-server-"));
    await fs.writeFile(path.join(clientDir, "index.html"), "<html><body>dashboard shell</body></html>", "utf8");
    const controller = createDashboardServerController({
      clientDir,
      service: {
        getDashboard: () => Promise.resolve(dashboard),
        getDebug: () => debug
      }
    });

    const firstUrl = await controller.ensureStarted();
    const secondUrl = await controller.ensureStarted();
    await controller.close();
    const thirdUrl = await controller.ensureStarted();

    expect(secondUrl).toBe(firstUrl);
    expect(thirdUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

    await controller.close();
  });
});
