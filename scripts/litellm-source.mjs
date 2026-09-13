import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";

const lockPath = "integrations/litellm/source.lock.json";
const lock = JSON.parse(readFileSync(lockPath, "utf8"));
const git = (args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const args = process.argv.slice(2);
try {
  if (!args.length || args[0] === "--check") {
    const entry = git(["ls-files", "--stage", "vendor/litellm"]).split(/\s+/);
    if (entry[0] !== "160000" || entry[1] !== lock.commit)
      throw new Error("LiteLLM gitlink does not match source.lock.json.");
    const url = git([
      "config",
      "-f",
      ".gitmodules",
      "--get",
      "submodule.vendor/litellm.url",
    ]);
    if (url !== lock.repository)
      throw new Error("LiteLLM source URL does not match source.lock.json.");
    console.log(
      `LiteLLM ${lock.release} · ${lock.commit} · ${lock.forkStatus}`,
    );
  } else if (args[0] === "--create-fork" || args[0] === "--use") {
    let repository = args[1];
    if (args[0] === "--create-fork") {
      const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
      if (!token)
        throw new Error(
          "Create your fork at https://github.com/BerriAI/litellm/fork then run npm run litellm:source -- --use OWNER/litellm. Alternatively supply GH_TOKEN with fork permission to this command.",
        );
      const response = await fetch(
        "https://api.github.com/repos/BerriAI/litellm/forks",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: "litellm", default_branch_only: true }),
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (!response.ok)
        throw new Error(
          `GitHub did not create the fork (HTTP ${response.status}).`,
        );
      repository = (await response.json()).full_name;
    }
    if (
      typeof repository !== "string" ||
      !/^[a-zA-Z0-9_.-]+\/litellm$/.test(repository) ||
      repository.toLowerCase() === "berriai/litellm"
    )
      throw new Error("Specify your GitHub fork as OWNER/litellm.");
    let info;
    for (let attempt = 0; attempt < 8; attempt++) {
      const response = await fetch(
        `https://api.github.com/repos/${repository}`,
        {
          headers: { Accept: "application/vnd.github+json" },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (response.ok) {
        info = await response.json();
        break;
      }
      if (args[0] !== "--create-fork") break;
      await setTimeout(2000);
    }
    if (
      !info?.fork ||
      info.parent?.full_name?.toLowerCase() !== "berriai/litellm"
    )
      throw new Error(
        "The destination must be an accessible fork of BerriAI/litellm.",
      );
    if (git(["-C", "vendor/litellm", "status", "--porcelain"]))
      throw new Error(
        "Commit or stash edits in the LiteLLM source checkout first.",
      );
    const url = `https://github.com/${repository}.git`;
    git(["-C", "vendor/litellm", "fetch", "--depth=1", url, lock.commit]);
    git(["config", "-f", ".gitmodules", "submodule.vendor/litellm.url", url]);
    git(["submodule", "sync", "--", "vendor/litellm"]);
    writeFileSync(
      lockPath,
      JSON.stringify(
        { ...lock, repository: url, forkStatus: "created" },
        null,
        2,
      ) + "\n",
    );
    console.log(
      `Fork linked: https://github.com/${repository}. Review and commit .gitmodules and ${lockPath}.`,
    );
  } else throw new Error("Use --check, --create-fork, or --use OWNER/litellm.");
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "LiteLLM source operation failed.",
  );
  process.exitCode = 1;
}
