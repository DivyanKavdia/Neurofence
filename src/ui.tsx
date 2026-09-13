import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  arr,
  can,
  Collection,
  Json,
  num,
  obj,
  Request,
  Row,
  Session,
  State,
  str,
  uid,
} from "./types";
export type ConsoleContextValue = {
  state: State;
  session: Session;
  page: string;
  tab: string;
  busy: boolean;
  go: (page: string, tab?: string, id?: string) => void;
  open: (content: ReactNode) => void;
  close: () => void;
  notify: (text: string) => void;
  setSession: (session: Session) => void;
  refresh: () => Promise<void>;
  request: <T = unknown>(request: Request) => Promise<T>;
  mutate: <T = unknown>(
    path: string,
    body?: Record<string, Json>,
    row?: Row,
    method?: "POST" | "PATCH" | "DELETE",
  ) => Promise<T>;
};
export const ConsoleContext = createContext<ConsoleContextValue>(null!);
export const useConsole = () => useContext(ConsoleContext);
export const money = (value: unknown) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(num(value));
export const date = (value: unknown) =>
  num(value)
    ? new Date(num(value)).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
export function Icon({ name = "grid" }: { name?: string }) {
  const paths: Record<string, string> = {
    grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    shield: "M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3z M8 12l3 3 5-6",
    layers: "m12 3 10 5-10 5L2 8l10-5z M2 12l10 5 10-5 M2 16l10 5 10-5",
    people:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M20 21v-2a4 4 0 0 0-3-3.9",
    route: "M4 5h9a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h11 M4 2v6 M17 18l3 3-3 3",
    bot: "M7 7h10a3 3 0 0 1 3 3v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a3 3 0 0 1 3-3z M12 3v4 M9 12v2 M15 12v2 M9 17h6",
    wallet: "M20 8V5H5a3 3 0 0 0 0 6h16v10H5V6 M21 12h-5v5h5",
    alert: "M12 3 2 21h20L12 3z M12 9v5 M12 17h.01",
    flask: "M9 3h6 M10 3v6L4 19a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2L14 9V3 M7 15h10",
    settings:
      "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2",
    search: "M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15 M16 16l5 5",
    plus: "M12 5v14 M5 12h14",
    close: "m6 6 12 12 M6 18 18 6",
    arrow: "M4 12h16 M14 6l6 6-6 6",
    check: "m5 12 4 4L19 6",
    clock: "M12 3a9 9 0 0 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2",
    menu: "M3 6h18 M3 12h18 M3 18h18",
    download: "M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5",
    activity: "M2 12h4l3-8 6 16 3-8h4",
    key: "M8 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10 M12 12l8 8 M16 16l3-3",
    server: "M3 3h18v7H3z M3 14h18v7H3z M7 6h.1 M7 17h.1",
  };
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name] || paths.grid} />
    </svg>
  );
}
export function Button({
  children,
  onClick,
  cap,
  disabled = false,
  primary = false,
  danger = false,
  type = "button",
  ...props
}: {
  children: ReactNode;
  onClick?: () => void;
  cap?: string;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
  type?: "button" | "submit";
  title?: string;
  "aria-label"?: string;
  className?: string;
}) {
  const ctx = useConsole();
  return (
    <button
      {...props}
      type={type}
      className={`button ${primary ? "primary" : ""} ${danger ? "danger" : ""} ${props.className || ""}`}
      disabled={disabled || ctx.busy || !!(cap && !can(ctx.session, cap))}
      onClick={onClick}
      title={
        cap && !can(ctx.session, cap)
          ? `Unavailable for ${ctx.session.role}`
          : props.title
      }
    >
      {children}
    </button>
  );
}
export const Badge = ({ value }: { value: unknown }) => (
  <span
    className={`badge ${["ALLOW", "Active", "Approved", "Healthy", "Passed", "Connected", "Released", "Sanctioned"].includes(str(value)) ? "green" : ["DENY", "Blocked", "Failed", "Critical", "Revoked", "Quarantined"].includes(str(value)) ? "red" : ["Pending", "Canary", "High", "REQUIRE_APPROVAL", "Running"].includes(str(value)) ? "amber" : "blue"}`}
  >
    {str(value) || "—"}
  </span>
);
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
export const Empty = ({
  title = "No matching results",
  text = "Change the filters or create your first record.",
}: {
  title?: string;
  text?: string;
}) => (
  <div className="empty">
    <Icon name="search" />
    <h3>{title}</h3>
    <p>{text}</p>
  </div>
);
export const Notice = ({ children }: { children: ReactNode }) => (
  <div className="notice">
    <Icon name="shield" />
    <div>{children}</div>
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
export function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function copy(value: string) {
  await navigator.clipboard.writeText(value);
}
export type Column = {
  key: string;
  label: string;
  render?: (row: Row) => ReactNode;
};
export function DataTable({
  rows,
  columns,
  name,
  onOpen,
  bulk,
}: {
  rows: Row[];
  columns: Column[];
  name: string;
  onOpen?: (row: Row) => void;
  bulk?: (rows: Row[]) => void;
}) {
  const ctx = useConsole(),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All"),
    [page, setPage] = useState(0),
    [sort, setSort] = useState(columns[0]?.key || "name"),
    [direction, setDirection] = useState(1),
    [selected, setSelected] = useState<string[]>([]),
    [hidden, setHidden] = useState<string[]>([]),
    [config, setConfig] = useState(false);
  const statuses = [
    ...new Set(
      rows.map((r) => str(r.status || r.decision || r.risk)).filter(Boolean),
    ),
  ];
  const filtered = rows
    .filter(
      (r) =>
        (filter === "All" ||
          str(r.status || r.decision || r.risk) === filter) &&
        JSON.stringify(r).toLowerCase().includes(query.toLowerCase()),
    )
    .sort(
      (a, b) =>
        direction *
        str(a[sort]).localeCompare(str(b[sort]), undefined, { numeric: true }),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / 8)),
    current = Math.min(page, pages - 1),
    visible = columns.filter((c) => !hidden.includes(c.key));
  const views = ctx.state.data.savedViews.filter((v) => v.page === name);
  const saveView = () =>
    ctx.open(
      <FormDialog
        title="Save table view"
        fields={[{ key: "name", label: "View name", required: true }]}
        onSubmit={async (body) => {
          await ctx.mutate("/api/v1/savedViews", {
            ...body,
            page: name,
            query,
            filter,
            columns: hidden,
            sort,
            direction,
          });
          ctx.close();
        }}
      />,
    );
  return (
    <>
      <div className="toolbar wrap">
        <label className="search-input">
          <Icon name="search" />
          <input
            aria-label={`Search ${name}`}
            placeholder={`Search ${name.toLowerCase()}`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <select
          aria-label={`Filter ${name}`}
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(0);
          }}
        >
          <option>All</option>
          {statuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          className="mobile-sort"
          aria-label={`Sort ${name}`}
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(0);
          }}
        >
          {columns.map((c) => (
            <option value={c.key} key={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <button
          className="button mobile-sort"
          aria-label={`Reverse ${name} sort order`}
          onClick={() => setDirection(-direction)}
        >
          {direction === 1 ? "Ascending ↑" : "Descending ↓"}
        </button>
        <Button
          onClick={() =>
            download(`${name.toLowerCase().replace(/\s/g, "-")}.json`, {
              prototype: true,
              records: filtered,
            })
          }
        >
          <Icon name="download" />
          Export
        </Button>
        <Button onClick={() => setConfig(!config)}>Columns</Button>
        <Button onClick={saveView}>Save view</Button>
        {views.length > 0 && (
          <select
            aria-label="Saved view"
            defaultValue=""
            onChange={(e) => {
              const view = views.find((v) => v.id === e.target.value);
              if (view) {
                setQuery(str(view.query));
                setFilter(str(view.filter));
                setHidden(arr<string>(view.columns));
                setSort(str(view.sort) || columns[0]?.key || "name");
                setDirection(num(view.direction, 1));
                setPage(0);
              }
            }}
          >
            <option value="">Saved views</option>
            {views.map((v) => (
              <option value={v.id} key={v.id}>
                {str(v.name)}
              </option>
            ))}
          </select>
        )}
      </div>
      {config && (
        <fieldset className="column-options">
          <legend>Visible columns</legend>
          {columns.map((c) => (
            <label key={c.key}>
              <input
                type="checkbox"
                checked={!hidden.includes(c.key)}
                disabled={visible.length === 1 && !hidden.includes(c.key)}
                onChange={() =>
                  setHidden(
                    hidden.includes(c.key)
                      ? hidden.filter((k) => k !== c.key)
                      : [...hidden, c.key],
                  )
                }
              />
              {c.label}
            </label>
          ))}
        </fieldset>
      )}
      {bulk && selected.length > 0 && (
        <div className="toolbar">
          <span>{selected.length} selected</span>
          <Button
            onClick={() => bulk(rows.filter((r) => selected.includes(r.id)))}
          >
            Review selected
          </Button>
          <Button onClick={() => setSelected([])}>Clear selection</Button>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {bulk && <th scope="col">Select</th>}
              {visible.map((c) => (
                <th
                  scope="col"
                  key={c.key}
                  aria-sort={
                    sort === c.key
                      ? direction === 1
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    className="table-sort"
                    onClick={() => {
                      setSort(c.key);
                      setDirection(sort === c.key ? -direction : 1);
                    }}
                  >
                    {c.label}
                    {sort === c.key ? (direction === 1 ? " ↑" : " ↓") : ""}
                  </button>
                </th>
              ))}
              {onOpen && <th scope="col">Review</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(current * 8, current * 8 + 8).map((r) => (
              <tr key={r.id}>
                {bulk && (
                  <td data-label="Select">
                    <input
                      type="checkbox"
                      aria-label={`Select ${str(r.name || r.title || r.id)}`}
                      checked={selected.includes(r.id)}
                      onChange={() =>
                        setSelected(
                          selected.includes(r.id)
                            ? selected.filter((id) => id !== r.id)
                            : [...selected, r.id],
                        )
                      }
                    />
                  </td>
                )}
                {visible.map((c) => (
                  <td key={c.key} data-label={c.label}>
                    {c.render ? c.render(r) : str(r[c.key]) || "—"}
                  </td>
                ))}
                {onOpen && (
                  <td data-label="Review">
                    <Button
                      onClick={() => onOpen(r)}
                      aria-label={`Open ${str(r.name || r.title || r.id)}`}
                    >
                      Open <Icon name="arrow" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && <Empty />}
      <div className="table-foot row between wrap">
        <span>
          {filtered.length} records · Page {current + 1} of {pages}
        </span>
        <div className="row">
          <Button disabled={current === 0} onClick={() => setPage(current - 1)}>
            Previous
          </Button>
          <Button
            disabled={current + 1 >= pages}
            onClick={() => setPage(current + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  );
}
export type Field = {
  key: string;
  label: string;
  type?:
    | "text"
    | "number"
    | "textarea"
    | "select"
    | "checkbox"
    | "multi"
    | "datetime"
    | "ordered";
  options?: (string | [string, string])[];
  required?: boolean;
  min?: number;
  max?: number;
  help?: string;
  default?: Json;
};
export function Fields({
  fields,
  values,
  setValues,
}: {
  fields: Field[];
  values: Record<string, Json>;
  setValues: (values: Record<string, Json>) => void;
}) {
  const id = useId(),
    set = (key: string, value: Json) => setValues({ ...values, [key]: value });
  return (
    <div className="form-grid">
      {fields.map((f) => {
        const value =
            values[f.key] ??
            f.default ??
            (f.type === "checkbox"
              ? false
              : f.type === "multi" || f.type === "ordered"
                ? []
                : ""),
          fid = `${id}-${f.key}`;
        return (
          <div
            className={`field ${["textarea", "multi", "ordered"].includes(f.type || "") ? "full" : ""}`}
            key={f.key}
          >
            <label htmlFor={fid}>
              {f.label}
              {f.required ? " *" : ""}
            </label>
            {f.type === "select" ? (
              <select
                id={fid}
                value={str(value)}
                required={f.required}
                onChange={(e) => set(f.key, e.target.value)}
              >
                <option value="">Select…</option>
                {f.options?.map((o) => (
                  <option
                    key={Array.isArray(o) ? o[0] : o}
                    value={Array.isArray(o) ? o[0] : o}
                  >
                    {Array.isArray(o) ? o[1] : o}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                id={fid}
                value={str(value)}
                required={f.required}
                rows={4}
                onChange={(e) => set(f.key, e.target.value)}
              />
            ) : f.type === "checkbox" ? (
              <input
                id={fid}
                type="checkbox"
                checked={!!value}
                onChange={(e) => set(f.key, e.target.checked)}
              />
            ) : f.type === "multi" || f.type === "ordered" ? (
              <div className="check-grid" role="group" aria-label={f.label}>
                {f.options?.map((o) => {
                  const key = Array.isArray(o) ? o[0] : o;
                  return (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={arr(value).includes(key)}
                        onChange={(e) =>
                          set(
                            f.key,
                            e.target.checked
                              ? [...arr(value), key]
                              : arr(value).filter((v) => v !== key),
                          )
                        }
                      />
                      {Array.isArray(o) ? o[1] : o}
                    </label>
                  );
                })}
                {f.type === "ordered" && (
                  <ol className="pipeline-order">
                    {arr<string>(value).map((key, i) => (
                      <li key={key}>
                        {key}
                        <button
                          type="button"
                          disabled={!i}
                          aria-label={`Move ${key} earlier`}
                          onClick={() => {
                            const list = arr<string>(value).slice();
                            [list[i - 1], list[i]] = [list[i], list[i - 1]];
                            set(f.key, list);
                          }}
                        >
                          ↑
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ) : (
              <input
                id={fid}
                type={
                  f.type === "datetime" ? "datetime-local" : f.type || "text"
                }
                value={
                  f.type === "datetime" && value
                    ? new Date(
                        num(value) - new Date().getTimezoneOffset() * 60000,
                      )
                        .toISOString()
                        .slice(0, 16)
                    : str(value)
                }
                min={f.min}
                max={f.max}
                step={f.type === "number" ? "any" : undefined}
                required={f.required}
                onChange={(e) =>
                  set(
                    f.key,
                    f.type === "number"
                      ? num(e.target.value)
                      : f.type === "datetime"
                        ? new Date(e.target.value).getTime()
                        : e.target.value,
                  )
                }
              />
            )}
            {f.help && <span className="field-help">{f.help}</span>}
          </div>
        );
      })}
    </div>
  );
}
export function FormDialog({
  title,
  sub,
  fields,
  initial = {},
  onSubmit,
  submit = "Save",
  children,
}: {
  title: string;
  sub?: string;
  fields: Field[];
  initial?: Record<string, Json>;
  onSubmit: (body: Record<string, Json>) => Promise<void>;
  submit?: string;
  children?: ReactNode;
}) {
  const ctx = useConsole(),
    [values, setValues] = useState<Record<string, Json>>(() =>
      Object.fromEntries(
        fields.map((f) => [
          f.key,
          initial[f.key] ??
            f.default ??
            (f.type === "checkbox"
              ? false
              : f.type === "multi" || f.type === "ordered"
                ? []
                : ""),
        ]),
      ),
    ),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  return (
    <>
      <h2>{title}</h2>
      {sub && <p className="page-sub">{sub}</p>}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          setError("");
          try {
            await onSubmit(values);
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "The change could not be saved.",
            );
          } finally {
            setSaving(false);
          }
        }}
      >
        <Fields fields={fields} values={values} setValues={setValues} />
        {children}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <Button onClick={ctx.close}>Cancel</Button>
          <Button primary type="submit" disabled={saving}>
            {saving ? "Saving…" : submit}
          </Button>
        </div>
      </form>
    </>
  );
}
export function Confirm({
  title,
  description,
  onConfirm,
  verb = "Confirm",
}: {
  title: string;
  description: string;
  onConfirm: (reason: string) => Promise<void>;
  verb?: string;
}) {
  return (
    <FormDialog
      title={title}
      sub={description}
      fields={[
        { key: "reason", label: "Reason", type: "textarea", required: true },
      ]}
      onSubmit={(body) => onConfirm(str(body.reason))}
      submit={verb}
    />
  );
}
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
export function Modal({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const heading = ref.current?.querySelector("h2");
    if (heading) heading.id = "dialog-title";
    ref.current
      ?.querySelector<HTMLElement>("input,select,textarea,button")
      ?.focus();
  }, [children]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";
    const node = ref.current;
    const heading = node?.querySelector("h2");
    if (heading) heading.id = "dialog-title";
    node?.querySelector<HTMLElement>("input,select,textarea,button")?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const list = [
          ...node!.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea,a[href]",
          ),
        ].filter((n) => n.getClientRects().length);
        const first = list[0],
          last = list.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handler);
      previous?.isConnected && previous.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="dialog"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <button
          className="icon-button dialog-close"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
        <div className="dialog-content">{children}</div>
      </div>
    </div>
  );
}
export function useAction() {
  const ctx = useConsole();
  return (
    path: string,
    body: Record<string, Json>,
    row?: Row,
    method: "POST" | "PATCH" | "DELETE" = "POST",
  ) => ctx.mutate(path, body, row, method).catch(() => undefined);
}
export function resourceOptions(state: State, c: Collection) {
  return state.data[c].map(
    (r) => [r.id, str(r.name || r.title || r.id)] as [string, string],
  );
}
export function TraceView({ trace }: { trace: Row }) {
  const ctx = useConsole();
  const reveal = async () => {
    try {
      const result = await ctx.mutate<{ content: Json }>(
        `/api/v1/traces/${trace.id}/reveal`,
        {},
        trace,
      );
      ctx.open(
        <>
          <h2>Retained content</h2>
          <Notice>This access has been added to the audit trail.</Notice>
          <pre>{JSON.stringify(result.content, null, 2)}</pre>
        </>,
      );
    } catch {}
  };
  return (
    <>
      <div className="row between wrap">
        <Badge value={trace.decision} />
        <span className="mono small">{trace.id}</span>
      </div>
      <p>{str(trace.reason)}</p>
      <Details
        row={trace}
        fields={[
          "principal",
          "target",
          "policyVersion",
          "workflow",
          "tokens",
          "cost",
          "budgetAttribution",
          ...(str(trace.modelRuntime).startsWith("litellm-")
            ? [
                "modelRuntime",
                "upstreamRequestId",
                "inputTokens",
                "outputTokens",
                "billingBasis",
                "pendingCost",
              ]
            : []),
        ]}
      />
      <div className="waterfall">
        {arr<Record<string, Json>>(trace.stages).map((s, i) => (
          <div className="trace-stage" key={i}>
            <span className="step-number">{i + 1}</span>
            <div>
              <strong>{str(s.name)}</strong>
              <p>{str(s.detail)}</p>
            </div>
            <Badge value={s.status} />
          </div>
        ))}
      </div>
      {trace.output && (
        <div className="response-box">
          <strong>Response</strong>
          <p>{str(trace.output)}</p>
        </div>
      )}
      <div className="row wrap">
        <Button
          onClick={async () => {
            try {
              download(
                "trace-evidence.json",
                await ctx.mutate(
                  `/api/v1/traces/${trace.id}/export`,
                  {},
                  trace,
                ),
              );
            } catch {}
          }}
        >
          Export evidence
        </Button>
        <Button cap="reveal" onClick={reveal}>
          Reveal retained content
        </Button>
        <Button
          cap="run"
          disabled={ctx.session.environment === "Production"}
          onClick={() =>
            ctx.go(
              trace.kind === "tool" ? "agents" : "gateway",
              trace.kind === "tool" ? "Tool playground" : "Playground",
              trace.id,
            )
          }
        >
          Replay in playground
        </Button>
      </div>
    </>
  );
}
