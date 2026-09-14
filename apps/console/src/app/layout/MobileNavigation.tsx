import { Icon } from "../../components/Icon";

import { useConsole } from "../ConsoleContext";
import { NavigationItem } from "../navigation";

export function MobileNavigation({
  items,
  onOpenMenu,
}: {
  items: NavigationItem[];
  onOpenMenu: () => void;
}) {
  const { page, go } = useConsole();
  return (
    <nav id="mobile-nav" aria-label="Mobile navigation">
      {[
        { id: "overview", label: "Home", icon: "grid" },
        { id: "gateway", label: "Gateway", icon: "route" },
        { id: "agents", label: "Agents", icon: "bot" },
        { id: "governance", label: "Review", icon: "shield" },
      ]
        .filter((n) => items.some((v) => v.id === n.id))
        .map((n) => (
          <button
            key={n.id}
            className={page === n.id ? "active" : ""}
            onClick={() =>
              go(n.id, n.id === "governance" ? "Approvals" : undefined)
            }
          >
            <Icon name={n.icon} />
            <span>{n.label}</span>
          </button>
        ))}
      <button onClick={() => onOpenMenu()} aria-label="More navigation">
        <Icon name="menu" />
        <span>More</span>
      </button>
    </nav>
  );
}
