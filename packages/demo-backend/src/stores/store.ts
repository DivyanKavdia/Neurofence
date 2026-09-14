import { State } from "@neurofence/contracts/types";
import { CompanyDirectory } from "@neurofence/contracts/company";

export interface Store {
  read(key: string): State | undefined;
  write(key: string, state: State): void;
  readDirectory(): CompanyDirectory | undefined;
  writeDirectory(directory: CompanyDirectory): void;
}
