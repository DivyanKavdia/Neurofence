import { spawnSync } from "node:child_process";
const result = spawnSync(process.env.NF_PYTHON || "python3", [
  "scripts/litellm_source.py", ...process.argv.slice(2),
], { stdio: "inherit" });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
