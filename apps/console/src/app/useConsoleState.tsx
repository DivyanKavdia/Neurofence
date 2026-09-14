import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  arr,
  can,
  initialSession,
  Json,
  Request,
  Row,
  Session,
  State,
  str,
  uid,
  users,
} from "@neurofence/contracts/types";
import { api } from "../lib/api";
import { GlobalSearch } from "./GlobalSearch";
import { navigation } from "./navigation";
import { readRoute, slugify } from "./router";

/** Owns the demo session, async requests, route state and temporary UI state. */
export function useConsoleState() {
  const [session, setSessionState] = useState<Session>(() => {
      try {
        const saved = JSON.parse(
          sessionStorage.getItem("neurofence.demo.session") || "null",
        );
        if (
          saved &&
          typeof saved.tenant === "string" &&
          typeof saved.environment === "string" &&
          typeof saved.user === "string" &&
          saved.role in users
        )
          return {
            tenant: saved.tenant,
            environment: saved.environment,
            region: saved.region || "India",
            user: saved.user,
            role: saved.role,
          };
      } catch {
        /* Use the initial company when no saved demo session exists. */
      }
      return initialSession;
    }),
    [state, setState] = useState<State | null>(null),
    [route, setRoute] = useState(readRoute),
    [modal, setModal] = useState<ReactNode>(null),
    [notice, setNotice] = useState(""),
    [error, setError] = useState<ApiError | null>(null),
    [busy, setBusy] = useState(false),
    [menu, setMenu] = useState(false),
    [signedOut, setSignedOut] = useState(false),
    [updatedElsewhere, setUpdatedElsewhere] = useState(false),
    [period, setPeriod] = useState(30);
  // Ignore responses from a previous refresh or company session.
  const latest = useRef(0),
    mutations = useRef(0);
  const close = useCallback(() => setModal(null), []);
  const notify = useCallback((message: string) => setNotice(message), []);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  const refresh = useCallback(async () => {
    const call = ++latest.current;
    try {
      const result = await api.request<State>({ path: "/api/v1/workspace" });
      if (call === latest.current) {
        setState(result.data);
        setError(null);
        setUpdatedElsewhere(false);
      }
    } catch (e) {
      if (call === latest.current)
        setError(
          e instanceof ApiError ? e : new ApiError(500, "UNKNOWN", String(e)),
        );
    }
  }, []);
  useEffect(() => {
    api.setSession(session);
    void refresh();
  }, [session, refresh]);
  useEffect(() => {
    const listener = (event: StorageEvent) => {
      if (
        event.key === "neurofence.companies.v1" ||
        event.key ===
          `neuralfence.console.v2.${session.tenant}:${session.environment}`
      )
        setUpdatedElsewhere(true);
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, [session.tenant, session.environment]);
  const setSession = useCallback((next: Session) => {
    next = {
      tenant: next.tenant,
      environment: next.environment,
      role: next.role,
      user: next.user,
      region: next.region,
    };
    try {
      sessionStorage.setItem("neurofence.demo.session", JSON.stringify(next));
    } catch {
      /* Session persistence is optional. */
    }
    latest.current++;
    api.setSession(next);
    setState(null);
    setSessionState(next);
    setModal(null);
    setMenu(false);
  }, []);
  useEffect(() => {
    if (!state) return;
    document.documentElement.style.setProperty(
      "--company-brand",
      str(state.settings.brandColor) || "#193b2a",
    );
    const rgb = (str(state.settings.brandColor) || "#193b2a")
      .slice(1)
      .match(/.{2}/g)!
      .map((c) => {
        const s = parseInt(c, 16) / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
    document.documentElement.style.setProperty(
      "--company-on-brand",
      rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 0.179
        ? "#101c19"
        : "#fff",
    );
    document.documentElement.dataset.companyTimezone =
      str(state.settings.timezone) || "Asia/Kolkata";
    if (!location.hash) go(str(state.settings.landingPage) || "overview");
  }, [
    state?.settings.brandColor,
    state?.settings.timezone,
    state?.settings.landingPage,
  ]);
  useEffect(() => {
    if (
      state?.data.jobs.some((j) => j.status === "Running") ||
      state?.data.campaigns.some((c) => c.scheduleEnabled)
    ) {
      const timer = setInterval(
        () => void refresh(),
        state.data.jobs.some((j) => j.status === "Running") ? 500 : 15000,
      );
      return () => clearInterval(timer);
    }
  }, [state, refresh]);
  const go = useCallback((page: string, tab?: string, id?: string) => {
    const nav = navigation.find((n) => n.id === page);
    const nextTab = tab || nav?.tabs[0] || "";
    const hash = `#${page}${nextTab ? "/" + slugify(nextTab) : ""}${id ? "?id=" + encodeURIComponent(id) : ""}`;
    if (location.hash !== hash) history.pushState(null, "", hash);
    setRoute(readRoute());
    setModal(null);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  useEffect(() => {
    const change = () => {
      setRoute(readRoute());
      setModal(null);
      setMenu(false);
    };
    window.addEventListener("popstate", change);
    window.addEventListener("hashchange", change);
    return () => {
      window.removeEventListener("popstate", change);
      window.removeEventListener("hashchange", change);
    };
  }, []);
  useEffect(() => {
    document
      .querySelector<HTMLElement>("#main h1")
      ?.focus({ preventScroll: true });
  }, [route]);
  const request = async <T,>(request: Request) => {
    try {
      return (await api.request<T>(request)).data;
    } catch (e) {
      const err =
        e instanceof ApiError ? e : new ApiError(500, "UNKNOWN", String(e));
      setError(err);
      throw err;
    }
  };
  const mutate = async <T,>(
    path: string,
    body: Record<string, Json> = {},
    row?: Row,
    method: "POST" | "PATCH" | "DELETE" = "POST",
  ) => {
    mutations.current++;
    setBusy(true);
    try {
      const data = await request<T>({
        method,
        path,
        body,
        version: row?.version,
        idempotencyKey: uid("mutation"),
      });
      await refresh();
      return data;
    } finally {
      mutations.current--;
      setBusy(mutations.current > 0);
    }
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setModal(<GlobalSearch />);
      }
      if (e.key === "Escape") setMenu(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
  const modules = arr<string>(state?.settings.modules),
    visible = navigation.filter((n) =>
      session.role === "Neurofence operator"
        ? n.id === "company"
        : (modules.includes(n.module) ||
            (n.id === "assurance" && modules.includes("M8"))) &&
          (n.id !== "demo" ||
            can(
              { ...session, permissions: state?.company?.permissions },
              "company",
            )),
    ),
    nav = visible.find((n) => n.id === route.page),
    tabs =
      nav?.tabs.filter(
        (t) =>
          (nav.id !== "company" ||
            (session.role === "Neurofence operator"
              ? t === "Overview"
              : !!state?.company?.administration || t === "Overview")) &&
          (nav.id !== "assurance" ||
            modules.includes(t === "Supply chain" ? "M8" : "M7")),
      ) || [];
  useEffect(() => {
    if (state && !nav) go("company", "Overview");
    else if (state && tabs.length && !tabs.includes(route.tab))
      go(route.page, tabs[0]);
  }, [state, route.page, route.tab]);

  return {
    session,
    state,
    route,
    modal,
    notice,
    error,
    busy,
    menu,
    signedOut,
    updatedElsewhere,
    period,
    close,
    notify,
    refresh,
    setSession,
    setModal,
    setMenu,
    setSignedOut,
    setPeriod,
    setError,
    go,
    request,
    mutate,
    visible,
    nav,
    tabs,
  };
}
