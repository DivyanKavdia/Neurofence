import React from "react";
import { str } from "@neurofence/contracts/types";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { JourneyDialog } from "../JourneyDialog";
import { SessionDialog } from "../SessionDialog";

import { useConsole } from "../ConsoleContext";
import { NavigationItem } from "../navigation";

export function Sidebar({
  items,
  onClose,
}: {
  items: NavigationItem[];
  onClose: () => void;
}) {
  const { state, session, page, go, open } = useConsole();
  return (
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
          onClick={() => onClose()}
        >
          <Icon name="close" />
        </button>
      </div>
      <button
        className="workspace-chip"
        onClick={() => open(<SessionDialog />)}
      >
        <span className="avatar">
          {state.settings.logo ? (
            <img
              className="company-logo"
              src={str(state.settings.logo)}
              alt=""
            />
          ) : (
            str(state.settings.name)
              .split(" ")
              .map((s) => s[0])
              .slice(0, 2)
              .join("")
          )}
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
        {items.map((item) => (
          <React.Fragment key={item.id}>
            {["company", "overview", "gateway", "budgets"].includes(
              item.id,
            ) && (
              <div className="nav-group-label">
                {
                  {
                    company: "Administration",
                    overview: "Workspace",
                    gateway: "AI runtime",
                    budgets: "Operations",
                  }[item.id]
                }
              </div>
            )}
            <button
              className={`nav-button ${page === item.id ? "active" : ""}`}
              aria-current={page === item.id ? "page" : undefined}
              onClick={() => go(item.id)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.id === "governance" &&
                state.data.approvals.some((a) => a.status === "Pending") && (
                  <span className="nav-count">
                    {
                      state.data.approvals.filter((a) => a.status === "Pending")
                        .length
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
          <Button onClick={() => open(<JourneyDialog />)}>
            Explore workflows →
          </Button>
        </div>
        <div className="sidebar-footer">
          <span className="dot" />
          DEMO WORKSPACE <span>v0.7</span>
        </div>
      </div>
    </aside>
  );
}
