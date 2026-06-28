const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const cwd = process.cwd();
const packageJson = require(path.join(cwd, "package.json"));
const releaseDir = path.join(cwd, "release");
const workDir = path.join(releaseDir, `package-work-${process.pid}`);
const unpackedDir = path.join(workDir, "win-unpacked");
const tmpUnpackedDir = path.join(workDir, "win-unpacked.tmp");
const exeName = `${packageJson.build.productName} ${packageJson.version}.exe`;
const workExePath = path.join(workDir, exeName);
const finalExePath = path.join(releaseDir, exeName);
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const electronBuilderCommand = path.join(
  cwd,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "electron-builder.cmd" : "electron-builder"
);

function isInsideWorkspace(target) {
  const relative = path.relative(cwd, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertInsideWorkspace(target) {
  if (!isInsideWorkspace(target)) {
    throw new Error(`Refusing to touch path outside workspace: ${target}`);
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  return result.status ?? 1;
}

function removeGeneratedDir(target) {
  assertInsideWorkspace(target);
  fs.rmSync(target, { recursive: true, force: true, maxRetries: 20, retryDelay: 500 });
}

function recoverUnpackedDir() {
  if (!fs.existsSync(tmpUnpackedDir)) {
    return false;
  }

  assertInsideWorkspace(tmpUnpackedDir);
  assertInsideWorkspace(unpackedDir);
  removeGeneratedDir(unpackedDir);
  fs.renameSync(tmpUnpackedDir, unpackedDir);
  return true;
}

const buildStatus = run(npmCommand, ["run", "build"]);
if (buildStatus !== 0) {
  process.exit(buildStatus);
}

removeGeneratedDir(workDir);
const outputArg = `--config.directories.output=${workDir}`;
const directStatus = run(electronBuilderCommand, ["--win", "portable", "--x64", outputArg]);
let packageStatus = directStatus;

if (directStatus !== 0 && recoverUnpackedDir()) {
  packageStatus = run(electronBuilderCommand, ["--win", "portable", "--x64", "--prepackaged", unpackedDir, outputArg]);
}

if (packageStatus !== 0) {
  process.exit(directStatus);
}

assertInsideWorkspace(finalExePath);
fs.mkdirSync(releaseDir, { recursive: true });
fs.copyFileSync(workExePath, finalExePath);
process.exit(0);
