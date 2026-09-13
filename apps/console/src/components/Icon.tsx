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
