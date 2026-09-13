import { useState } from "react";
import { str } from "@neurofence/contracts/types";
import { Icon } from "../components/Icon";
import { ResourceDetail } from "../features/catalog/ResourceDetail";
import { useConsole } from "./ConsoleContext";
import { navigation } from "./navigation";

export function GlobalSearch() {
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
