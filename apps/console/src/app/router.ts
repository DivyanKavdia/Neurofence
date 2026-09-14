import { navigation } from "./navigation";

export function readRoute() {
  const hash = location.hash.slice(1),
    [path, query] = hash.split("?"),
    [page, slug] = path.split("/"),
    nav =
      navigation.find((n) => n.id === page) ||
      navigation.find((n) => n.id === "overview")!;
  return {
    page: nav.id,
    tab: nav.tabs.find((t) => slugify(t) === slug) || nav.tabs[0] || "",
    id: new URLSearchParams(query).get("id") || undefined,
  };
}

export const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-$/, "");
