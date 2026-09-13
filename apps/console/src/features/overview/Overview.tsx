import { num, str } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { JourneyDialog } from "../../app/JourneyDialog";
import { Button } from "../../components/Button";
import { Badge, Empty } from "../../components/feedback";
import { Details, Panel, Stats } from "../../components/layout";
import { money } from "../../lib/format";
import { IncidentDetail } from "../incidents/IncidentDetail";
import { Traces } from "../traces/Traces";

export function Overview() {
  const ctx = useConsole(),
    { state } = ctx,
    d = state.data,
    spend = d.traces.reduce((n, t) => n + num(t.cost), 0);
  return (
    <>
      <section className="trust-hero">
        <div className="hero-copy">
          <div className="hero-kicker">UNIFIED AI SECURITY</div>
          <h2>
            Intelligence,
            <br />
            <em>under control.</em>
          </h2>
          <p>
            Every model request. Every agent action. One place to see the
            decision.
          </p>
          <div className="row wrap">
            <Button onClick={() => ctx.open(<JourneyDialog />)}>
              Explore workflows →
            </Button>
            <Button onClick={() => ctx.go("governance", "Approvals")}>
              Review requests
            </Button>
          </div>
        </div>
        <div className="hero-mesh">
          <img
            className="hero-logo"
            src="assets/brand/neuralfence-mark-reversed.svg"
            alt="NeuralFence neural shield"
          />
          <div className="hero-caption">POLICY · IDENTITY · EVIDENCE</div>
        </div>
      </section>
      <Stats
        items={[
          {
            label: "Governed assets",
            value: d.assets.filter((a) => a.coverage === "Governed").length,
            detail: `${d.assets.filter((a) => a.coverage !== "Governed").length} need control coverage`,
            go: () => ctx.go("inventory"),
          },
          {
            label: "Requests blocked",
            value: d.traces.filter((t) => t.decision === "DENY").length,
            detail: "Policy decisions with evidence",
            go: () => ctx.go("gateway", "Traces"),
          },
          {
            label: "Open incidents",
            value: d.incidents.filter((i) => i.status !== "Resolved").length,
            detail: "Prioritized review queue",
            go: () => ctx.go("incidents"),
          },
          {
            label: "Attributed spend",
            value: money(spend),
            detail: "Sample usage ledger",
            go: () => ctx.go("budgets"),
          },
        ]}
      />
      <div className="cols equal">
        <Panel
          title="Needs your attention"
          sub="Prioritized actions across the workspace."
        >
          <div className="action-list">
            {d.approvals
              .filter((a) => a.status === "Pending")
              .slice(0, 3)
              .map((a) => (
                <button
                  key={a.id}
                  onClick={() => ctx.go("governance", "Approvals")}
                >
                  <Badge value="Pending" />
                  <span>{str(a.name || a.tool)}</span>
                  <span>Review →</span>
                </button>
              ))}
            {d.incidents
              .filter((i) => i.status !== "Resolved")
              .slice(0, 3)
              .map((i) => (
                <button
                  key={i.id}
                  onClick={() => ctx.open(<IncidentDetail id={i.id} />)}
                >
                  <Badge value={i.severity} />
                  <span>{str(i.title)}</span>
                  <span>Investigate →</span>
                </button>
              ))}
            {!d.approvals.some((a) => a.status === "Pending") &&
              !d.incidents.some((i) => i.status !== "Resolved") && (
                <Empty
                  title="Review queue clear"
                  text="New findings and approvals appear here."
                />
              )}
          </div>
        </Panel>
        <Panel
          title="Platform health"
          sub="Deployment and dependency states for the selected workspace."
        >
          <Details
            row={state.settings}
            fields={["deployment", "residency", "controlPlane"]}
          />
          <div className="health-grid">
            {[
              "Identity & policy",
              "Gateway",
              "Guardrails",
              "Event delivery",
            ].map((name) => (
              <div key={name}>
                <span>{name}</span>
                <Badge
                  value={
                    state.settings.controlPlane === "Unavailable"
                      ? "Cached"
                      : "Healthy"
                  }
                />
              </div>
            ))}
          </div>
          <Button onClick={() => ctx.go("governance", "Settings")}>
            Open deployment settings
          </Button>
        </Panel>
      </div>
      <Traces compact />
    </>
  );
}
