import { num } from "@neurofence/contracts/types";

export const money = (value: unknown) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(num(value));

export const date = (value: unknown) =>
  num(value)
    ? new Date(num(value)).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
