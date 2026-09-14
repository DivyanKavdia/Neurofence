import { Role, users } from "@neurofence/contracts/types";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { GlobalSearch } from "../GlobalSearch";
import { SessionDialog } from "../SessionDialog";
import { ActionQueue, WorkspaceHelp } from "../WorkspaceAssistance";

import { useConsole } from "../ConsoleContext";

export function Header({
  title,
  menu,
  onToggleMenu,
  period,
  onPeriodChange,
  onSignOut,
}: {
  title?: string;
  menu: boolean;
  onToggleMenu: () => void;
  period: number;
  onPeriodChange: (days: number) => void;
  onSignOut: () => void;
}) {
  const { state, session, page, tab, open, close, setSession } = useConsole();
  return (
    <header id="topbar">
      <div className="row">
        <button
          className="icon-button mobile-menu"
          aria-label="Open navigation"
          aria-expanded={menu}
          aria-controls="sidebar"
          onClick={() => onToggleMenu()}
        >
          <Icon name="menu" />
        </button>
        <div className="crumb">
          <span>Workspace</span>
          <strong>{title}</strong>
        </div>
        <div className="mobile-brand">
          <img width="26" src="assets/brand/neuralfence-mark.svg" alt="" />
          NeuralFence
        </div>
      </div>
      <div className="top-actions">
        <button
          className="search-launch"
          aria-label="Search workspace"
          onClick={() => open(<GlobalSearch />)}
        >
          <Icon name="search" />
          <span>Search workspace</span>
          <kbd>⌘ K</kbd>
        </button>
        <button
          className="icon-button workspace-shortcut"
          aria-label="Workspace action queue"
          title="Action queue"
          onClick={() => open(<ActionQueue />)}
        >
          <Icon name="activity" />
        </button>
        <button
          className="icon-button workspace-shortcut"
          aria-label="Contextual help"
          title="Help"
          onClick={() => open(<WorkspaceHelp />)}
        >
          <span aria-hidden="true">?</span>
        </button>
        {["overview", "gateway", "guardrails", "agents", "incidents"].includes(
          page,
        ) &&
          (page !== "guardrails" || tab === "Overview") && (
            <label className="period-control">
              <span className="sr-only">Time range</span>
              <select
                value={period}
                aria-label="Time range"
                onChange={(e) => onPeriodChange(Number(e.target.value))}
              >
                <option value={1}>24 hours</option>
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={365}>All sample activity</option>
              </select>
            </label>
          )}
        <label className="role-control">
          <span className="role-label">Preview as</span>
          <select
            aria-label="Role preview"
            value={session.role}
            onChange={(e) =>
              setSession({
                ...session,
                role: e.target.value as Role,
                user:
                  e.target.value === "Neurofence operator"
                    ? users["Neurofence operator"]
                    : state.company?.identities.find((m) =>
                        m.roles.includes(e.target.value as Role),
                      )?.name || users[e.target.value as Role],
              })
            }
          >
            {[
              ...new Set([
                ...(state.company?.identities.flatMap((m) => m.roles) || [
                  session.role,
                ]),
                "Neurofence operator" as Role,
              ]),
            ].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <button
          className="avatar profile-button"
          aria-label="Profile and workspace"
          onClick={() =>
            open(
              <>
                <SessionDialog />
                <div className="row wrap">
                  <Button onClick={() => open(<ActionQueue />)}>
                    Workspace action queue
                  </Button>
                  <Button onClick={() => open(<WorkspaceHelp />)}>
                    Contextual help
                  </Button>
                </div>
                <Button
                  onClick={() => {
                    onSignOut();
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
  );
}
