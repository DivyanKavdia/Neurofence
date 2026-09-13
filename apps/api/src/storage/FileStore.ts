import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { ApiError, State } from "@neurofence/contracts/types";
import { Store } from "@neurofence/demo-backend";

export class FileStore implements Store {
  private scopesDir: string;
  constructor(private storeDir: string) {
    mkdirSync(storeDir, { recursive: true });
    this.scopesDir = resolve(storeDir, "scopes");
    mkdirSync(this.scopesDir, { recursive: true, mode: 0o700 });
  }
  private path(key: string) {
    if (!/^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$/.test(key))
      throw new ApiError(400, "INVALID_CONTEXT", "Invalid workspace context.");
    return resolve(
      this.scopesDir,
      Buffer.from(key).toString("base64url") + ".json",
    );
  }
  read(key: string) {
    const file = this.path(key);
    if (existsSync(file))
      return JSON.parse(readFileSync(file, "utf8")) as State;
    const legacy = resolve(this.storeDir, key.replace(":", "-") + ".json");
    if (!existsSync(legacy)) return undefined;
    if (!/^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+$/.test(key))
      throw new ApiError(
        409,
        "LEGACY_SCOPE_AMBIGUOUS",
        "Verify ownership of this legacy workspace file before migrating it to the encoded scope directory.",
      );
    return JSON.parse(readFileSync(legacy, "utf8")) as State;
  }
  write(key: string, state: State) {
    const file = this.path(key);
    writeFileSync(file + ".tmp", JSON.stringify(state), {
      mode: 0o600,
      flush: true,
    });
    renameSync(file + ".tmp", file);
    if (process.platform !== "win32") {
      const directory = openSync(this.scopesDir, "r");
      try {
        fsyncSync(directory);
      } finally {
        closeSync(directory);
      }
    }
  }
}
