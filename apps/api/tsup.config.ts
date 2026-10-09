import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  // node:sqlite is a prefix-only builtin; bare "sqlite" resolves as an npm package.
  removeNodeProtocol: false,
  noExternal: ["@hnd/shared"],
  outDir: "dist",
  clean: true,
  sourcemap: true,
});
