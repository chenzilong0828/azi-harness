import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["packages/cli/src/bin.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "dist/azi.js",
  external: ["node:*", "yaml"],
  logLevel: "info"
});

console.log("Bundle complete: dist/azi.js");
