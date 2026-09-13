import { ReactNode } from "react";
import { can } from "@neurofence/contracts/types";
import { useConsole } from "../app/ConsoleContext";

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
