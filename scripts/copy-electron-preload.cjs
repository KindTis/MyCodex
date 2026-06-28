const fs = require("node:fs");
const path = require("node:path");

const source = path.resolve("electron/preload.cjs");
const target = path.resolve("dist/electron/electron/preload.cjs");

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
