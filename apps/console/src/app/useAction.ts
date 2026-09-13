import { Json, Row } from "@neurofence/contracts/types";
import { useConsole } from "./ConsoleContext";

export function useAction() {
  const ctx = useConsole();
  return (
    path: string,
    body: Record<string, Json>,
    row?: Row,
    method: "POST" | "PATCH" | "DELETE" = "POST",
  ) => ctx.mutate(path, body, row, method).catch(() => undefined);
}
