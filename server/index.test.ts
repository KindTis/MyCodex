import type { Server } from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createApp, isMainModule } from "./index.js";
import type { DashboardResponse, DebugResponse } from "./data/types.js";

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

async function withServer<T>(
  service: Parameters<typeof createApp>[0],
  run: (url: string) => Promise<T>,
  options?: Parameters<typeof createApp>[1]
) {
  const app = createApp(service, options);
  const server = await new Promise<Server>((resolve) => {
    const nextServer = app.listen(0, "127.0.0.1", () => resolve(nextServer));
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  try {
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

describe("Express API", () => {
  it("clientDir option으로 Electron 패키지의 dist/client를 서빙할 수 있다", async () => {
    const clientDir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-dashboard-client-"));
    await fs.writeFile(path.join(clientDir, "index.html"), "<html><body>electron dashboard</body></html>", "utf8");

    await withServer(
      {
        getDashboard: () => Promise.resolve(dashboard),
        getDebug: () => debug
      },
      async (url) => {
        const response = await fetch(`${url}/anything`);

        expect(response.ok).toBe(true);
        expect(await response.text()).toContain("electron dashboard");
      },
      { clientDir }
    );
  });

  it("server/index.js가 직접 실행될 때만 main module로 판단한다", () => {
    const serverPath = path.resolve("dist/server/index.js");
    const serverUrl = pathToFileURL(serverPath).toString();

    expect(isMainModule(serverUrl, ["node", serverPath])).toBe(true);
    expect(isMainModule(serverUrl, ["electron", path.resolve("dist/electron/electron/main.js")])).toBe(false);
  });

  it("GET /api/dashboard가 통합 응답을 반환한다", async () => {
    await withServer(
      {
        getDashboard: () => Promise.resolve(dashboard),
        getDebug: () => debug
      },
      async (url) => {
        const response = await fetch(`${url}/api/dashboard`);

        expect(response.ok).toBe(true);
        expect(await response.json()).toEqual(dashboard);
      }
    );
  });

  it("GET /api/dashboard가 weekOffset query를 서비스에 전달한다", async () => {
    const getDashboard = vi.fn(() => Promise.resolve(dashboard));

    await withServer(
      {
        getDashboard,
        getDebug: () => debug
      },
      async (url) => {
        const response = await fetch(`${url}/api/dashboard?weekOffset=2`);

        expect(response.ok).toBe(true);
        expect(getDashboard).toHaveBeenCalledWith({ weekOffset: 2 });
      }
    );
  });

  it("잘못된 weekOffset query는 0으로 처리한다", async () => {
    const getDashboard = vi.fn(() => Promise.resolve(dashboard));

    await withServer(
      {
        getDashboard,
        getDebug: () => debug
      },
      async (url) => {
        const response = await fetch(`${url}/api/dashboard?weekOffset=-1`);

        expect(response.ok).toBe(true);
        expect(getDashboard).toHaveBeenCalledWith({ weekOffset: 0 });
      }
    );
  });

  it("GET /api/debug가 원본 JSON 없이 요약을 반환한다", async () => {
    await withServer(
      {
        getDashboard: () => Promise.resolve(dashboard),
        getDebug: () => debug
      },
      async (url) => {
        const response = await fetch(`${url}/api/debug`);
        const body = await response.json();

        expect(response.ok).toBe(true);
        expect(body.ccusage.summary.rows).toBe(1);
        expect(JSON.stringify(body)).not.toContain("secret");
      }
    );
  });

  it("예기치 못한 API 오류를 sanitization 한다", async () => {
    await withServer(
      {
        getDashboard: () => Promise.reject(new Error("token=abcd123456789 C:\\Users\\tester\\secret")),
        getDebug: () => debug
      },
      async (url) => {
        const response = await fetch(`${url}/api/dashboard`);
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body.message).not.toContain("abcd123456789");
        expect(body.message).not.toContain("tester");
      }
    );
  });
});
