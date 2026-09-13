import { ReactNode, useState } from "react";
import { arr, num, Row, str } from "@neurofence/contracts/types";
import { useConsole } from "../app/ConsoleContext";
import { download } from "../lib/files";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { FormDialog } from "./dialogs";
import { Empty } from "./feedback";

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
