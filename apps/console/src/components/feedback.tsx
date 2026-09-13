import { ReactNode } from "react";
import { str } from "@neurofence/contracts/types";
import { Icon } from "./Icon";

export const Badge = ({ value }: { value: unknown }) => (
  <span
    className={`badge ${["ALLOW", "Active", "Approved", "Healthy", "Passed", "Connected", "Released", "Sanctioned"].includes(str(value)) ? "green" : ["DENY", "Blocked", "Failed", "Critical", "Revoked", "Quarantined"].includes(str(value)) ? "red" : ["Pending", "Canary", "High", "REQUIRE_APPROVAL", "Running"].includes(str(value)) ? "amber" : "blue"}`}
  >
    {str(value) || "—"}
  </span>
);

export const Empty = ({
  title = "No matching results",
  text = "Change the filters or create your first record.",
}: {
  title?: string;
  text?: string;
}) => (
  <div className="empty">
    <Icon name="search" />
    <h3>{title}</h3>
    <p>{text}</p>
  </div>
);

export const Notice = ({ children }: { children: ReactNode }) => (
  <div className="notice">
    <Icon name="shield" />
    <div>{children}</div>
  </div>
);
