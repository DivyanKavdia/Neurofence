import { createContext, ReactNode, useContext } from "react";
import {
  Json,
  Request,
  Row,
  Session,
  State,
} from "@neurofence/contracts/types";

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
