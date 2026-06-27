import type { Server } from "node:http";
import { createApp } from "./index.js";
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

async function withServer<T>(service: Parameters<typeof createApp>[0], run: (url: string) => Promise<T>) {
  const app = createApp(service);
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
