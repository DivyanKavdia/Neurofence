import { ApiError, str } from "@neurofence/contracts/types";
import { Button } from "../../components/Button";
import { PageHead } from "../../components/layout";
import { Page } from "../Page";
import { SessionDialog } from "../SessionDialog";
import { TimeScope } from "../TimeScope";

import { useConsole } from "../ConsoleContext";
import { NavigationItem } from "../navigation";

export function WorkspaceContent({
  nav,
  tabs,
  focusId,
  period,
  error,
  updatedElsewhere,
  onDismissError,
}: {
  nav?: NavigationItem;
  tabs: string[];
  focusId?: string;
  period: number;
  error: ApiError | null;
  updatedElsewhere: boolean;
  onDismissError: () => void;
}) {
  const {
    state,
    session,
    page,
    tab: selectedTab,
    busy,
    go,
    open,
    refresh,
  } = useConsole();
  return (
    <main id="main" tabIndex={-1} aria-busy={busy}>
      {updatedElsewhere && (
        <div className="workspace-update" role="status">
          <span>This workspace changed in another tab.</span>
          <Button onClick={() => void refresh()}>Refresh workspace</Button>
        </div>
      )}
      {error && (
        <div className="api-error" role="alert">
          <div>
            <strong>{error.message}</strong>
            <small>
              {error.code} · {error.correlationId}
            </small>
          </div>
          <Button onClick={() => void refresh()}>Refresh</Button>
          <Button onClick={() => onDismissError()}>Dismiss</Button>
        </div>
      )}
      <PageHead
        title={nav?.label || "Workspace"}
        sub={nav?.description || `${session.environment} workspace`}
        actions={
          <Button onClick={() => open(<SessionDialog />)}>
            Switch workspace
          </Button>
        }
      />
      {tabs.length > 0 && (
        <div className="tabs" role="tablist" aria-label={`${nav?.label} views`}>
          {tabs.map((tab) => (
            <button
              key={tab}
              role="tab"
              tabIndex={tab === selectedTab ? 0 : -1}
              className={`tab ${tab === selectedTab ? "active" : ""}`}
              aria-selected={tab === selectedTab}
              onClick={() => go(page, tab)}
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
                go(page, tabs[index]);
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      )}
      <TimeScope days={period}>
        <Page
          key={`${page}:${selectedTab}:${focusId || ""}`}
          focusId={focusId}
        />
      </TimeScope>
      <footer className="page-footer">
        <span>
          {state.settings.modelRuntime === "mock"
            ? "Demo backend · Sample model and tool execution"
            : "LiteLLM model execution · Demo control plane"}
        </span>
        <span>
          {str(state.settings.name)} · {session.environment}
        </span>
      </footer>
    </main>
  );
}
