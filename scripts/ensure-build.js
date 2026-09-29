import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const built =
  existsSync("dist/index.js") &&
  existsSync("dist/index.cjs") &&
  existsSync("dist/index.d.ts") &&
  existsSync("dist/cli.js");

const canBuild = existsSync("node_modules/tsup/package.json");

if (canBuild) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npm, ["run", "build"], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}

if (built) {
  process.exit(0);
}

console.error("avid-wiki-api: dist/ is missing and tsup is not installed, so the package cannot be built.");
process.exit(1);
