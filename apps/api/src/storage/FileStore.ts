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
import { CompanyDirectory } from "@neurofence/contracts/company";
import { Store } from "@neurofence/demo-backend";

export class FileStore implements Store {
  readDirectory() {
    const file = resolve(this.storeDir, "companies.v1.json");
    if (!existsSync(file)) return undefined;
    const directory = JSON.parse(readFileSync(file, "utf8"));
    if (directory.schema !== 1 || !Array.isArray(directory.companies))
      throw new ApiError(
        500,
        "COMPANY_STORE_INVALID",
        "Company data requires recovery.",
      );
    return directory as CompanyDirectory;
  }
  writeDirectory(directory: CompanyDirectory) {
    this.atomicWrite(
      resolve(this.storeDir, "companies.v1.json"),
      directory,
      this.storeDir,
    );
  }
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
    this.atomicWrite(file, state, this.scopesDir);
  }
  private atomicWrite(
    file: string,
    state: State | CompanyDirectory,
    parent: string,
  ) {
    writeFileSync(file + ".tmp", JSON.stringify(state), {
      mode: 0o600,
      flush: true,
    });
    renameSync(file + ".tmp", file);
    if (process.platform !== "win32") {
      const directory = openSync(parent, "r");
      try {
        fsyncSync(directory);
      } finally {
        closeSync(directory);
      }
    }
  }
}
