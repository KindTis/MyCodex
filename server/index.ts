import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dashboardService } from "./data/dashboardService.js";
import { sanitizeMessage } from "./utils/sanitize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(__dirname, "../client");

type DashboardHttpService = Pick<typeof dashboardService, "getDashboard" | "getDebug">;

export function createApp(service: DashboardHttpService = dashboardService) {
  const app = express();

  app.use(express.json());

  app.get("/api/dashboard", async (_req, res) => {
    try {
      res.json(await service.getDashboard());
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

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 4317);
  const host = process.env.HOST ?? "127.0.0.1";
  app.listen(port, host, () => {
    console.log(`Codex usage dashboard listening on http://${host}:${port}`);
  });
}
