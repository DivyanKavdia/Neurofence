import * as esbuild from "esbuild";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const consoleOutput = "assets/console";

async function publishConsole(result) {
  if (result.errors.length) return;
  const outputs = Object.keys(result.metafile.outputs);
  const script = outputs.find((p) => p.endsWith(".js"));
  const css = outputs.find((p) => p.endsWith(".css"));
  await writeFile(
    "index.html",
    `<!doctype html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#193b2a"><meta name="description" content="NeuralFence enterprise AI security workspace. Interactive frontend with a simulated backend."><link rel="icon" href="assets/brand/neuralfence-icon.svg"><title>NeuralFence · AI trust workspace</title><link rel="stylesheet" href="${css}"><script src="config.js"></script><script defer src="${script}"></script></head><body><div id="root"></div><noscript>Enable JavaScript to use the NeuralFence prototype.</noscript></body></html>\n`,
  );
  // Keep the current build, including its font and license sidecars.
  for (const file of await readdir(consoleOutput)) {
    if (!outputs.includes(`${consoleOutput}/${file}`))
      await rm(`${consoleOutput}/${file}`);
  }
}

/** Output names stay stable for local scripts and integration tests. */
export async function build({ watch = false } = {}) {
  await mkdir(consoleOutput, { recursive: true });
  await mkdir(".runtime", { recursive: true });
  const targets = [
    {
      entryPoints: ["apps/console/src/main.tsx"],
      bundle: true,
      minify: true,
      outdir: consoleOutput,
      entryNames: "app-[hash]",
      assetNames: "[name]-[hash]",
      metafile: true,
      loader: { ".woff": "file" },
      target: ["es2022"],
      define: { "process.env.NODE_ENV": '"production"' },
      legalComments: "linked",
      plugins: [
        { name: "publish-console", setup: (ctx) => ctx.onEnd(publishConsole) },
      ],
    },
    ...[
      ["packages/demo-backend/src/index.ts", ".runtime/backend.cjs"],
      ["apps/api/src/server.ts", ".runtime/mock-server.cjs"],
      ["apps/api/src/gateway.ts", ".runtime/gateway.cjs"],
    ].map(([entry, outfile]) => ({
      entryPoints: [entry],
      bundle: true,
      platform: "node",
      format: "cjs",
      outfile,
      target: "node22",
    })),
  ];
  const contexts = [];
  try {
    for (const options of targets) {
      const ctx = await esbuild.context(options);
      contexts.push(ctx);
      await ctx.rebuild();
    }
    if (watch) {
      for (const ctx of contexts) await ctx.watch();
      console.log(
        "Watching console and API source. Refresh the browser after a rebuild.",
      );
    } else {
      await Promise.all(contexts.map((ctx) => ctx.dispose()));
      console.log("Built the static console and local API.");
    }
    return async () => Promise.all(contexts.map((ctx) => ctx.dispose()));
  } catch (error) {
    await Promise.all(contexts.map((ctx) => ctx.dispose()));
    throw error;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await build();
