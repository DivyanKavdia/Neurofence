import React, { ReactNode } from "react";
import { Row, str } from "@neurofence/contracts/types";
import { Icon } from "./Icon";

export const Panel = ({
  title,
  sub,
  children,
  actions,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
  actions?: ReactNode;
}) => (
  <section className="panel">
    <div className="panel-head">
      <div>
        <h2>{title}</h2>
        {sub && <p className="panel-sub">{sub}</p>}
      </div>
      {actions && <div className="row wrap">{actions}</div>}
    </div>
    <div className="panel-body padded">{children}</div>
  </section>
);

export const PageHead = ({
  title,
  sub,
  actions,
}: {
  title: string;
  sub: string;
  actions?: ReactNode;
}) => (
  <div className="page-head">
    <div>
      <div className="eyebrow">AI trust workspace</div>
      <h1 tabIndex={-1}>{title}</h1>
      <p className="page-sub">{sub}</p>
    </div>
    <div className="page-actions">{actions}</div>
  </div>
);

export const Stats = ({
  items,
}: {
  items: { label: string; value: ReactNode; detail: string; go?: () => void }[];
}) => (
  <div className="stats">
    {items.map((x) => (
      <button
        key={x.label}
        className={`stat ${x.go ? "stat-link" : ""}`}
        onClick={x.go}
        disabled={!x.go}
      >
        <div className="stat-label">
          {x.label}
          <Icon name="activity" />
        </div>
        <div className="stat-value num">{x.value}</div>
        <div className="stat-meta">{x.detail}</div>
      </button>
    ))}
  </div>
);

export function Details({ row, fields }: { row: Row; fields: string[] }) {
  return (
    <dl className="info-grid">
      {fields.map((key) => (
        <React.Fragment key={key}>
          <div>
            <dt>{key.replace(/([A-Z])/g, " $1")}</dt>
            <dd>
              {typeof row[key] === "object"
                ? JSON.stringify(row[key])
                : str(row[key]) || "—"}
            </dd>
          </div>
        </React.Fragment>
      ))}
    </dl>
  );
}
