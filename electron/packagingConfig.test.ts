import fs from "node:fs";
import path from "node:path";

describe("packaging config", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8")) as {
    main?: string;
    scripts?: Record<string, string>;
    devDependencies?: Record<string, string>;
    build?: {
      appId?: string;
      productName?: string;
      asar?: boolean;
      directories?: { output?: string };
      files?: string[];
      win?: { target?: string[]; icon?: string };
    };
  };

  it("Windows portable 실행 파일을 만들 수 있는 electron-builder 설정을 가진다", () => {
    expect(packageJson.main).toBe("dist/electron/electron/main.js");
    expect(packageJson.scripts?.["package:overlay"]).toBe("node scripts/package-overlay.cjs");
    expect(packageJson.devDependencies?.["electron-builder"]).toEqual(expect.any(String));
    expect(packageJson.build).toMatchObject({
      appId: "local.mycodex.usage-overlay",
      productName: "MyCodex Usage Overlay",
      asar: false,
      directories: { output: "release" },
      win: { target: ["portable"], icon: "icon.png" }
    });
    expect(packageJson.build?.files).toEqual(
      expect.arrayContaining(["dist/client/**/*", "dist/electron/**/*", "node_modules/**/*", "package.json"])
    );
    expect(fs.existsSync(path.resolve("icon.png"))).toBe(true);
    expect(fs.existsSync(path.resolve("scripts/package-overlay.cjs"))).toBe(true);
  });
});
