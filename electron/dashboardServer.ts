import type { Express } from "express";
import type { Server } from "node:http";
import { createApp } from "../server/index.js";
import type { DashboardRequest, DashboardResponse, DebugResponse } from "../server/data/types.js";

type DashboardHttpService = {
  getDashboard: (options?: DashboardRequest) => Promise<DashboardResponse>;
  getDebug: () => DebugResponse;
};

type LogLike = {
  write: (event: string, fields?: Record<string, unknown>) => Promise<unknown> | unknown;
};

type CreateAppLike = (service: DashboardHttpService, options: { clientDir: string }) => Express;

function serverUrl(server: Server, host: string): string {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("대시보드 서버 주소를 확인하지 못했습니다.");
  }

  return `http://${host}:${address.port}`;
}

function listen(app: Express, host: string): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, host);
    server.once("error", reject);
    server.once("listening", () => {
      server.off("error", reject);
      resolve(server);
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

export function createDashboardServerController(options: {
  clientDir: string;
  service: DashboardHttpService;
  createApp?: CreateAppLike;
  host?: string;
  log?: LogLike;
}) {
  const host = options.host ?? "127.0.0.1";
  const createDashboardApp = options.createApp ?? createApp;
  let server: Server | null = null;
  let url: string | null = null;

  async function ensureStarted(): Promise<string> {
    if (server && url) {
      return url;
    }

    const app = createDashboardApp(options.service, { clientDir: options.clientDir });
    server = await listen(app, host);
    url = serverUrl(server, host);
    await options.log?.write("dashboard-server-started", { url });
    return url;
  }

  async function close(): Promise<void> {
    if (!server) {
      return;
    }

    const currentServer = server;
    server = null;
    url = null;
    await closeServer(currentServer);
    await options.log?.write("dashboard-server-stopped");
  }

  return {
    ensureStarted,
    close
  };
}
