import { readFileSync, writeFileSync } from "node:fs";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  target: "es2022",
  outDir: "dist",
  async onSuccess() {
    for (const file of ["dist/cli.js", "dist/cli.cjs"]) {
      const source = readFileSync(file, "utf8");
      if (!source.startsWith("#!")) {
        writeFileSync(file, `#!/usr/bin/env node\n${source}`);
      }
    }
  },
});
