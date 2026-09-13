import React, {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import { api } from "./api";
import {
  ApiError,
  arr,
  initialSession,
  Json,
  Request,
  Role,
  roles,
  Row,
  Session,
  State,
  str,
  uid,
  users,
} from "./types";
import {
  Button,
  ConsoleContext,
  FormDialog,
  Icon,
  Modal,
  PageHead,
  Panel,
  useConsole,
} from "./ui";
import { JourneyDialog, navigation, Page } from "./pages";
import { ResourceDetail } from "./catalogs";
import "./styles.css";
import "./console.css";

function readRoute() {
  const hash = location.hash.slice(1),
    [path, query] = hash.split("?"),
    [page, slug] = path.split("/"),
    nav = navigation.find((n) => n.id === page) || navigation[0];
  return {
    page: nav.id,
    tab: nav.tabs.find((t) => slugify(t) === slug) || nav.tabs[0] || "",
    id: new URLSearchParams(query).get("id") || undefined,
  };
}
const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-$/, "");
function App() {
  const [session, setSessionState] = useState<Session>(initialSession),
    [state, setState] = useState<State | null>(null),
    [route, setRoute] = useState(readRoute),
    [modal, setModal] = useState<ReactNode>(null),
    [notice, setNotice] = useState(""),
    [error, setError] = useState<ApiError | null>(null),
    [busy, setBusy] = useState(false),
    [menu, setMenu] = useState(false),
    [signedOut, setSignedOut] = useState(false),
    [period, setPeriod] = useState(30);
  const latest = useRef(0),
    mutations = useRef(0);
  const close = useCallback(() => setModal(null), []);
  const notify = useCallback((message: string) => setNotice(message), []);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  const refresh = useCallback(async () => {
    const call = ++latest.current;
    try {
      const result = await api.request<State>({ path: "/api/v1/workspace" });
      if (call === latest.current) {
        setState(result.data);
        setError(null);
      }
    } catch (e) {
      if (call === latest.current)
        setError(
          e instanceof ApiError ? e : new ApiError(500, "UNKNOWN", String(e)),
        );
    }
  }, []);
  useEffect(() => {
    api.setSession(session);
    void refresh();
  }, [session, refresh]);
  const setSession = useCallback((next: Session) => {
    latest.current++;
    api.setSession(next);
    setState(null);
    setSessionState(next);
    setModal(null);
    setMenu(false);
  }, []);
  useEffect(() => {
    if (state?.data.jobs.some((j) => j.status === "Running")) {
      const timer = setInterval(() => void refresh(), 500);
      return () => clearInterval(timer);
    }
  }, [state, refresh]);
  const go = useCallback((page: string, tab?: string, id?: string) => {
    const nav = navigation.find((n) => n.id === page);
    const nextTab = tab || nav?.tabs[0] || "";
    const hash = `#${page}${nextTab ? "/" + slugify(nextTab) : ""}${id ? "?id=" + encodeURIComponent(id) : ""}`;
    if (location.hash !== hash) history.pushState(null, "", hash);
    setRoute(readRoute());
    setModal(null);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  useEffect(() => {
    const change = () => {
      setRoute(readRoute());
      setModal(null);
      setMenu(false);
    };
    window.addEventListener("popstate", change);
    window.addEventListener("hashchange", change);
    return () => {
      window.removeEventListener("popstate", change);
      window.removeEventListener("hashchange", change);
    };
  }, []);
  useEffect(() => {
    document
      .querySelector<HTMLElement>("#main h1")
      ?.focus({ preventScroll: true });
  }, [route]);
  const request = async <T,>(request: Request) => {
    try {
      return (await api.request<T>(request)).data;
    } catch (e) {
      const err =
        e instanceof ApiError ? e : new ApiError(500, "UNKNOWN", String(e));
      setError(err);
      throw err;
    }
  };
  const mutate = async <T,>(
    path: string,
    body: Record<string, Json> = {},
    row?: Row,
    method: "POST" | "PATCH" | "DELETE" = "POST",
  ) => {
    mutations.current++;
    setBusy(true);
    try {
      const data = await request<T>({
        method,
        path,
        body,
        version: row?.version,
        idempotencyKey: uid("mutation"),
      });
      await refresh();
      return data;
    } finally {
      mutations.current--;
      setBusy(mutations.current > 0);
    }
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setModal(<GlobalSearch />);
      }
      if (e.key === "Escape") setMenu(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
  const modules = arr<string>(state?.settings.modules),
    visible = navigation.filter(
      (n) =>
        modules.includes(n.module) ||
        (n.id === "assurance" && modules.includes("M8")),
    ),
    nav = visible.find((n) => n.id === route.page),
    tabs =
      nav?.tabs.filter(
        (t) =>
          nav.id !== "assurance" ||
          modules.includes(t === "Supply chain" ? "M8" : "M7"),
      ) || [];
  useEffect(() => {
    if (state && !nav) go("governance", "Settings");
    else if (state && tabs.length && !tabs.includes(route.tab))
      go(route.page, tabs[0]);
  }, [state, route.page, route.tab]);
  if (!state)
    return (
      <div className="boot-screen">
        <img
          src="assets/brand/neuralfence-mark.svg"
          alt="NeuralFence"
          width="64"
        />
        <h1>{error ? "Workspace unavailable" : "Opening your workspace…"}</h1>
        {error ? (
          <>
            <p role="alert">{error.message}</p>
            <button className="button" onClick={() => void refresh()}>
              Retry connection
            </button>
          </>
        ) : (
          <p role="status">Loading configuration and sample activity.</p>
        )}
      </div>
    );
  const context = {
    state,
    session,
    page: route.page,
    tab: route.tab,
    busy,
    go,
    open: setModal,
    close,
    notify,
    setSession,
    refresh,
    request,
    mutate,
  };
  return (
    <ConsoleContext.Provider value={context}>
      {signedOut ? (
        <div className="boot-screen">
          <img
            src="assets/brand/neuralfence-mark.svg"
            alt="NeuralFence"
            width="80"
          />
          <h1>Welcome to NeuralFence</h1>
          <p>Explore a governed AI workspace with sample data.</p>
          <Button primary onClick={() => setSignedOut(false)}>
            Continue to demo workspace
          </Button>
          <small>
            Production sign-in will use your enterprise identity provider.
          </small>
        </div>
      ) : (
        <div
          className={`app-shell ${menu ? "menu-open" : ""} ${state.settings.density === "Compact" ? "compact-density" : ""}`}
        >
          <a className="sr-only" href="#main">
            Skip to content
          </a>
          <aside id="sidebar" aria-label="Main navigation">
            <div className="brand row">
              <img
                className="logo-mark"
                src="assets/brand/neuralfence-mark.svg"
                alt=""
              />
              <div>
                <div className="brand-name">NeuralFence</div>
                <div className="brand-sub">Intelligence, secured</div>
              </div>
              <button
                className="icon-button nav-close"
                aria-label="Close navigation"
                onClick={() => setMenu(false)}
              >
                <Icon name="close" />
              </button>
            </div>
            <button
              className="workspace-chip"
              onClick={() => setModal(<SessionDialog />)}
            >
              <span className="avatar">
                {str(state.settings.name)
                  .split(" ")
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <span>
                <strong>{str(state.settings.name)}</strong>
                <br />
                <small>
                  {session.environment} · {session.region}
                </small>
              </span>
            </button>
            <nav>
              {visible.map((item, i) => (
                <React.Fragment key={item.id}>
                  {[0, 3, 6].includes(i) && (
                    <div className="nav-group-label">
                      {i === 0
                        ? "Workspace"
                        : i === 3
                          ? "AI runtime"
                          : "Operations"}
                    </div>
                  )}
                  <button
                    className={`nav-button ${route.page === item.id ? "active" : ""}`}
                    aria-current={route.page === item.id ? "page" : undefined}
                    onClick={() => go(item.id)}
                  >
                    <Icon name={item.icon} />
                    <span>{item.label}</span>
                    {item.id === "governance" &&
                      state.data.approvals.some(
                        (a) => a.status === "Pending",
                      ) && (
                        <span className="nav-count">
                          {
                            state.data.approvals.filter(
                              (a) => a.status === "Pending",
                            ).length
                          }
                        </span>
                      )}
                  </button>
                </React.Fragment>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <div className="sidebar-note">
                <h3>Explore the whole workflow</h3>
                <p>Nine guided journeys from connection to evidence.</p>
                <Button onClick={() => setModal(<JourneyDialog />)}>
                  Explore workflows →
                </Button>
              </div>
              <div className="sidebar-footer">
                <span className="dot" />
                DEMO WORKSPACE <span>v0.4</span>
              </div>
            </div>
          </aside>
          {menu && (
            <button
              className="mobile-scrim"
              aria-label="Close navigation overlay"
              onClick={() => setMenu(false)}
            />
          )}
          <header id="topbar">
            <div className="row">
              <button
                className="icon-button mobile-menu"
                aria-label="Open navigation"
                aria-expanded={menu}
                aria-controls="sidebar"
                onClick={() => setMenu(!menu)}
              >
                <Icon name="menu" />
              </button>
              <div className="crumb">
                <span>Workspace</span>
                <strong>{nav?.label}</strong>
              </div>
              <div className="mobile-brand">
                <img
                  width="26"
                  src="assets/brand/neuralfence-mark.svg"
                  alt=""
                />
                NeuralFence
              </div>
            </div>
            <div className="top-actions">
              <button
                className="search-launch"
                aria-label="Search workspace"
                onClick={() => setModal(<GlobalSearch />)}
              >
                <Icon name="search" />
                <span>Search workspace</span>
                <kbd>⌘ K</kbd>
              </button>
              <label className="period-control">
                <span className="sr-only">Time range</span>
                <select
                  value={period}
                  aria-label="Time range"
                  onChange={(e) => setPeriod(Number(e.target.value))}
                >
                  <option value={1}>24 hours</option>
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={365}>All sample activity</option>
                </select>
              </label>
              <label className="role-control">
                <span className="role-label">Preview as</span>
                <select
                  aria-label="Role preview"
                  value={session.role}
                  onChange={(e) =>
                    setSession({
                      ...session,
                      role: e.target.value as Role,
                      user: users[e.target.value as Role],
                    })
                  }
                >
                  {roles.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <button
                className="avatar profile-button"
                aria-label="Profile and workspace"
                onClick={() =>
                  setModal(
                    <>
                      <SessionDialog />
                      <Button
                        onClick={() => {
                          setSignedOut(true);
                          close();
                        }}
                      >
                        Sign out of demo
                      </Button>
                    </>,
                  )
                }
              >
                {session.user
                  .split(" ")
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")}
              </button>
            </div>
          </header>
          <main id="main" tabIndex={-1} aria-busy={busy}>
            {error && (
              <div className="api-error" role="alert">
                <div>
                  <strong>{error.message}</strong>
                  <small>
                    {error.code} · {error.correlationId}
                  </small>
                </div>
                <Button onClick={() => void refresh()}>Refresh</Button>
                <Button onClick={() => setError(null)}>Dismiss</Button>
              </div>
            )}
            <PageHead
              title={nav?.label || "Workspace"}
              sub={
                route.page === "overview"
                  ? "Your AI estate, decisions and priorities at a glance."
                  : `${session.environment} workspace · ${str(state.settings.deployment)} · ${session.region}`
              }
              actions={
                <Button onClick={() => setModal(<SessionDialog />)}>
                  Switch workspace
                </Button>
              }
            />
            {tabs.length > 0 && (
              <div
                className="tabs"
                role="tablist"
                aria-label={`${nav?.label} views`}
              >
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    role="tab"
                    tabIndex={tab === route.tab ? 0 : -1}
                    className={`tab ${tab === route.tab ? "active" : ""}`}
                    aria-selected={tab === route.tab}
                    onClick={() => go(route.page, tab)}
                    onKeyDown={(event) => {
                      if (
                        !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                          event.key,
                        )
                      )
                        return;
                      event.preventDefault();
                      const index =
                        event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? tabs.length - 1
                            : (tabs.indexOf(tab) +
                                (event.key === "ArrowRight" ? 1 : -1) +
                                tabs.length) %
                              tabs.length;
                      event.currentTarget.parentElement
                        ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                        [index]?.focus();
                      go(route.page, tabs[index]);
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            )}
            <TimeScope days={period}>
              <Page
                key={`${route.page}:${route.tab}:${route.id || ""}`}
                focusId={route.id}
              />
            </TimeScope>
            <footer className="page-footer">
              <span>
                Simulated backend · No live provider or tool execution
              </span>
              <span>
                {str(state.settings.name)} · {session.environment}
              </span>
            </footer>
          </main>
          <nav id="mobile-nav" aria-label="Mobile navigation">
            {[
              { id: "overview", label: "Home", icon: "grid" },
              { id: "gateway", label: "Gateway", icon: "route" },
              { id: "agents", label: "Agents", icon: "bot" },
              { id: "governance", label: "Review", icon: "shield" },
            ]
              .filter((n) => visible.some((v) => v.id === n.id))
              .map((n) => (
                <button
                  key={n.id}
                  className={route.page === n.id ? "active" : ""}
                  onClick={() =>
                    go(n.id, n.id === "governance" ? "Approvals" : undefined)
                  }
                >
                  <Icon name={n.icon} />
                  <span>{n.label}</span>
                </button>
              ))}
            <button onClick={() => setMenu(true)} aria-label="More navigation">
              <Icon name="menu" />
              <span>More</span>
            </button>
          </nav>
        </div>
      )}
      {modal && <Modal onClose={close}>{modal}</Modal>}
      <div id="toasts" role="status" aria-live="polite">
        {notice && (
          <div className="toast">
            <Icon name="check" />
            {notice}
          </div>
        )}
      </div>
    </ConsoleContext.Provider>
  );
}
// Time filters apply to activity surfaces, never to configuration or historical budget enforcement.
function TimeScope({ days, children }: { days: number; children: ReactNode }) {
  const ctx = useConsole();
  const cutoff = Date.now() - days * 86400000;
  const activity = [
    "overview",
    "gateway",
    "guardrails",
    "agents",
    "incidents",
  ].includes(ctx.page);
  const scoped = activity
    ? {
        ...ctx,
        state: {
          ...ctx.state,
          data: {
            ...ctx.state.data,
            traces: ctx.state.data.traces.filter((t) => Number(t.ts) > cutoff),
          },
        },
      }
    : ctx;
  return (
    <ConsoleContext.Provider value={scoped}>{children}</ConsoleContext.Provider>
  );
}
function SessionDialog() {
  const ctx = useConsole();
  const names =
    ctx.session.role === "Security admin"
      ? ["Mira Kapoor", "Arjun Rao"]
      : ctx.session.role === "Platform admin"
        ? ["Divyan Kavdia", "Platform reviewer"]
        : [users[ctx.session.role]];
  return (
    <FormDialog
      title="Workspace and profile"
      sub="Switch isolated demo workspaces or preview an independent reviewer."
      fields={[
        {
          key: "tenant",
          label: "Workspace",
          type: "select",
          options: [
            ["acme", "Acme Financial"],
            ["northstar", "Northstar Labs"],
          ],
        },
        {
          key: "environment",
          label: "Environment",
          type: "select",
          options: ["Development", "Staging", "Production"],
        },
        {
          key: "region",
          label: "Region context",
          type: "select",
          options: ["India", "Global"],
        },
        { key: "user", label: "Demo identity", type: "select", options: names },
      ]}
      initial={ctx.session}
      submit="Switch context"
      onSubmit={async (body) =>
        ctx.setSession({ ...ctx.session, ...body } as Session)
      }
    />
  );
}
function GlobalSearch() {
  const ctx = useConsole(),
    [query, setQuery] = useState(""),
    catalogs = [
      "projects",
      "agents",
      "providers",
      "assets",
      "policies",
      "routes",
      "budgets",
      "servers",
      "tools",
    ] as const;
  const results = catalogs
    .flatMap((collection) =>
      ctx.state.data[collection]
        .filter((r) => str(r.name).toLowerCase().includes(query.toLowerCase()))
        .map((row) => ({ collection, row })),
    )
    .slice(0, 12);
  return (
    <>
      <h2>Search your workspace</h2>
      <label className="field">
        Name or keyword
        <input
          aria-label="Global search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </label>
      <div className="search-results">
        {query
          ? results.map(({ collection, row }) => (
              <button
                key={`${collection}-${row.id}`}
                className="search-result"
                onClick={() =>
                  ctx.open(
                    <ResourceDetail collection={collection} id={row.id} />,
                  )
                }
              >
                <Icon name="search" />
                <span>
                  <strong>{str(row.name)}</strong>
                  <small>{collection}</small>
                </span>
                <Icon name="arrow" />
              </button>
            ))
          : navigation.map((n) => (
              <button
                className="search-result"
                key={n.id}
                onClick={() => ctx.go(n.id)}
              >
                <Icon name={n.icon} />
                {n.label}
              </button>
            ))}
      </div>
      {query && !results.length && <p>No matching records in this scope.</p>}
    </>
  );
}
class ErrorBoundary extends React.Component<
  { children: ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <div className="boot-screen">
        <h1>The view could not open</h1>
        <p>{this.state.error}</p>
        <button className="button" onClick={() => location.reload()}>
          Reload workspace
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
