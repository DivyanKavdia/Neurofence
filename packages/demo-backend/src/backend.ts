import { ProviderConnector } from "@neurofence/contracts/provider";
import {
  initialSession,
  Request,
  Result,
  Session,
  Transport,
} from "@neurofence/contracts/types";
import { dispatch } from "./dispatch";
import { MemoryStore } from "./stores/memory";
import { Store } from "./stores/store";

/** Stateful demo transport. Model calls may use an explicit server-only connector. */
export class MockBackend implements Transport {
  session = { ...initialSession };
  private queue = Promise.resolve();
  private receipts = new Map<
    string,
    { payload: string; result: Result; permissions: string[] }
  >();
  constructor(
    private store: Store = new MemoryStore(),
    private latency = 80,
    private providerConnector?: ProviderConnector,
  ) {}
  setSession(session: Session) {
    this.session = { ...session };
  }
  async request<T>(request: Request): Promise<Result<T>> {
    const session = { ...this.session };
    if (this.latency)
      await new Promise((resolve) => setTimeout(resolve, this.latency));
    const work = this.queue.then(() =>
      dispatch(request, session, {
        store: this.store,
        receipts: this.receipts,
        providerConnector: this.providerConnector,
      }),
    );
    this.queue = work.then(
      () => undefined,
      () => undefined,
    );
    return (await work) as Result<T>;
  }
}
