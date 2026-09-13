import { Collection, State, str } from "@neurofence/contracts/types";

export function resourceOptions(state: State, c: Collection) {
  return state.data[c].map(
    (r) => [r.id, str(r.name || r.title || r.id)] as [string, string],
  );
}
