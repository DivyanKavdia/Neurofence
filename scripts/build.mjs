import * as esbuild from "esbuild";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
await mkdir("assets/console", { recursive: true });
for (const file of await readdir("assets/console"))
  await rm(`assets/console/${file}`);
const result = await esbuild.build({
  entryPoints: ["src/main.tsx"],
  bundle: true,
  minify: true,
  outdir: "assets/console",
  entryNames: "app-[hash]",
  assetNames: "[name]-[hash]",
  metafile: true,
  loader: { ".woff": "file" },
  target: ["es2022"],
  define: { "process.env.NODE_ENV": '"production"' },
  legalComments: "linked",
});
const script = Object.keys(result.metafile.outputs).find((p) =>
  p.endsWith(".js"),
);
const css = Object.keys(result.metafile.outputs).find((p) =>
  p.endsWith(".css"),
);
await writeFile(
  "index.html",
  `<!doctype html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#193b2a"><meta name="description" content="NeuralFence enterprise AI security workspace. Interactive frontend with a simulated backend."><link rel="icon" href="assets/brand/neuralfence-icon.svg"><title>NeuralFence · AI trust workspace</title><link rel="stylesheet" href="${css}"><script src="config.js"></script><script defer src="${script}"></script></head><body><div id="root"></div><noscript>Enable JavaScript to use the NeuralFence prototype.</noscript></body></html>\n`,
);
await mkdir(".runtime", { recursive: true });
await esbuild.build({
  entryPoints: ["src/backend.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: ".runtime/backend.cjs",
  target: "node22",
});
await esbuild.build({
  entryPoints: ["server/mock-server.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: ".runtime/mock-server.cjs",
  target: "node22",
});
console.log("Built the static console and optional mock HTTP server.");
