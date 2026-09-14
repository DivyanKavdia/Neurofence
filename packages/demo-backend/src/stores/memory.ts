import { State } from "@neurofence/contracts/types";
import { CompanyDirectory } from "@neurofence/contracts/company";
import { Store } from "./store";

export class MemoryStore implements Store {
  directory?: CompanyDirectory;
  readDirectory() {
    return this.directory && structuredClone(this.directory);
  }
  writeDirectory(directory: CompanyDirectory) {
    this.directory = structuredClone(directory);
  }
  values = new Map<string, State>();
  read(key: string) {
    return this.values.get(key);
  }
  write(key: string, state: State) {
    this.values.set(key, structuredClone(state));
  }
}
