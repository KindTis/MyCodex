import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createAppLog } from "./appLog.js";

describe("appLog", () => {
  it("로그 메시지에 sanitizeMessage를 적용한다", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-overlay-log-"));
    const log = createAppLog({ logDir: dir });

    await log.write("usage-error", { message: "token=abcdef123456 C:\\Users\\tester\\secret" });

    const content = await fs.readFile(log.logPath, "utf8");
    expect(content).not.toContain("abcdef123456");
    expect(content).not.toContain("tester");
  });

  it("app.log가 maxBytes 초과면 app.previous.log로 rotate한다", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-overlay-log-"));
    const log = createAppLog({ logDir: dir, maxBytes: 8 });
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(log.logPath, "0123456789", "utf8");

    await log.write("after-rotate");

    expect(await fs.readFile(log.previousLogPath, "utf8")).toBe("0123456789");
    expect(await fs.readFile(log.logPath, "utf8")).toContain("after-rotate");
  });

  it("로그 write 실패는 caller를 crash시키지 않고 실패 결과를 반환한다", async () => {
    const log = createAppLog({
      logDir: "C:/bad",
      fsImpl: {
        mkdir: vi.fn(() => Promise.resolve(undefined)),
        stat: vi.fn(() => Promise.reject(Object.assign(new Error("missing"), { code: "ENOENT" }))),
        rm: vi.fn(),
        rename: vi.fn(),
        appendFile: vi.fn(() => Promise.reject(new Error("disk full")))
      } as never
    });

    await expect(log.write("event")).resolves.toMatchObject({ ok: false });
  });
});
