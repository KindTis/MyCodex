import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dashboardService } from "./data/dashboardService.js";
import type { DashboardRequest, DashboardResponse, DebugResponse } from "./data/types.js";
import { sanitizeMessage } from "./utils/sanitize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultClientDir = path.resolve(__dirname, "../client");

type DashboardHttpService = {
  getDashboard: (options?: DashboardRequest) => Promise<DashboardResponse>;
  getDebug: () => DebugResponse;
};

function parseWeekOffset(value: unknown): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : 0;

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

export function isMainModule(metaUrl: string, argv = process.argv): boolean {
  const entryPath = argv[1];
  if (!entryPath) {
    return false;
  }

  return path.resolve(entryPath) === fileURLToPath(metaUrl);
}

export function createApp(service: DashboardHttpService = dashboardService, options: { clientDir?: string } = {}) {
  const app = express();
  const clientDir = options.clientDir ?? defaultClientDir;

  app.use(express.json());

  app.get("/api/dashboard", async (req, res) => {
    try {
      res.json(await service.getDashboard({ weekOffset: parseWeekOffset(req.query.weekOffset) }));
    } catch (error) {
      res.status(500).json({ message: sanitizeMessage(error) });
    }
  });

  app.get("/api/debug", (_req, res) => {
    try {
      res.json(service.getDebug());
    } catch (error) {
      res.status(500).json({ message: sanitizeMessage(error) });
    }
  });

  if (fs.existsSync(clientDir)) {
    app.use(express.static(clientDir));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        next();
        return;
      }
      res.sendFile(path.join(clientDir, "index.html"));
    });
  }

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ message: sanitizeMessage(error) });
  });

  return app;
}

export const app = createApp();

if (process.env.NODE_ENV !== "test" && isMainModule(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4317);
  const host = process.env.HOST ?? "127.0.0.1";
  app.listen(port, host, () => {
    console.log(`Codex usage dashboard listening on http://${host}:${port}`);
  });
}
