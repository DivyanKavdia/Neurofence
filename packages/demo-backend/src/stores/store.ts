import { State } from "@neurofence/contracts/types";

export interface Store {
  read(key: string): State | undefined;
  write(key: string, state: State): void;
}
