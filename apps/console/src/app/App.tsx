import { initialSession, users } from "@neurofence/contracts/types";
import { Button } from "../components/Button";
import { Modal } from "../components/dialogs";
import { Icon } from "../components/Icon";
import { ConsoleContext } from "./ConsoleContext";

import { useConsoleState } from "./useConsoleState";
import { Sidebar } from "./layout/Sidebar";
import { Header } from "./layout/Header";
import { WorkspaceContent } from "./layout/WorkspaceContent";
import { MobileNavigation } from "./layout/MobileNavigation";

export function App() {
  const {
    session,
    state,
    route,
    modal,
    notice,
    error,
    busy,
    menu,
    signedOut,
    updatedElsewhere,
    period,
    close,
    notify,
    refresh,
    setSession,
    setModal,
    setMenu,
    setSignedOut,
    setPeriod,
    setError,
    go,
    request,
    mutate,
    visible,
    nav,
    tabs,
  } = useConsoleState();
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
            <button
              className="button"
              onClick={() => {
                setSession(initialSession);
                go("company", "Overview");
              }}
            >
              Return to initial demo company
            </button>
            <button
              className="button"
              onClick={() => {
                setSession({
                  ...initialSession,
                  role: "Neurofence operator",
                  user: users["Neurofence operator"],
                });
                go("company", "Overview");
              }}
            >
              Open operator demo
            </button>
          </>
        ) : (
          <p role="status">Loading configuration and sample activity.</p>
        )}
      </div>
    );
  const context = {
    state,
    session: { ...session, permissions: state.company?.permissions },
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
          <Sidebar items={visible} onClose={() => setMenu(false)} />
          {menu && (
            <button
              className="mobile-scrim"
              aria-label="Close navigation overlay"
              onClick={() => setMenu(false)}
            />
          )}
          <Header
            title={nav?.label}
            menu={menu}
            onToggleMenu={() => setMenu(!menu)}
            period={period}
            onPeriodChange={setPeriod}
            onSignOut={() => setSignedOut(true)}
          />
          <WorkspaceContent
            nav={nav}
            tabs={tabs}
            focusId={route.id}
            period={period}
            error={error}
            updatedElsewhere={updatedElsewhere}
            onDismissError={() => setError(null)}
          />
          <MobileNavigation items={visible} onOpenMenu={() => setMenu(true)} />
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
