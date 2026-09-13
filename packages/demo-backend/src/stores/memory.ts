import { State } from "@neurofence/contracts/types";
import { Store } from "./store";

export class MemoryStore implements Store {
  values = new Map<string, State>();
  read(key: string) {
    return this.values.get(key);
  }
  write(key: string, state: State) {
    this.values.set(key, structuredClone(state));
  }
}
