import { useConsole } from "./ConsoleContext";
import { journeys } from "./journeys";

export function JourneyDialog() {
  const ctx = useConsole();
  return (
    <>
      <h2>Explore nine connected workflows</h2>
      <p>
        Each journey selects a suitable demo role. All changes stay in the
        selected workspace.
      </p>
      <div className="journey-grid">
        {journeys.map(([title, desc, page, tab, role], i) => (
          <button
            className="journey-card"
            key={title}
            onClick={() => {
              ctx.setSession({
                ...ctx.session,
                role: role as typeof ctx.session.role,
                user:
                  role === "Security admin"
                    ? "Mira Kapoor"
                    : role === "FinOps owner"
                      ? "Ananya Rao"
                      : role === "SOC analyst"
                        ? "Neha Singh"
                        : role === "Agent owner"
                          ? "Priya Shah"
                          : "Divyan Kavdia",
              });
              ctx.go(page, tab);
            }}
          >
            <span className="step-number">{i + 1}</span>
            <strong>{title}</strong>
            <p>{desc}</p>
            <small>{role} →</small>
          </button>
        ))}
      </div>
    </>
  );
}
