import { build } from "./build.mjs";

const stopBuild = await build({ watch: true });
const { server } = await import("./serve.mjs");

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, async () => {
    server.close();
    await stopBuild();
    process.exit(0);
  });
}
