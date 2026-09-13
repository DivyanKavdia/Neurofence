import { ApiError, State } from "@neurofence/contracts/types";
import { createState } from "../fixtures/seed";
import { Store } from "./store";

export class BrowserStore implements Store {
  read(key: string) {
    try {
      const saved = JSON.parse(
        localStorage.getItem(`neuralfence.console.v2.${key}`) || "null",
      );
      if (saved?.schema === 2) return saved as State;
      if (key === "acme:Development") {
        const old = JSON.parse(
          localStorage.getItem("neuralfence.prototype.v1") || "null",
        );
        if (old?.schema === 1 && Array.isArray(old.projects))
          return createState(old);
      }
    } catch {
      /* A damaged or unavailable browser store must not prevent the demo opening. */
    }
    return undefined;
  }
  write(key: string, state: State) {
    try {
      localStorage.setItem(
        `neuralfence.console.v2.${key}`,
        JSON.stringify(state),
      );
    } catch {
      throw new ApiError(
        507,
        "STORAGE_FULL",
        "Browser storage is unavailable. Export your work, free storage and retry.",
      );
    }
  }
}
