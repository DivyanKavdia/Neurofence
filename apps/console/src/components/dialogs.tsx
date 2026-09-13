import { ReactNode, useEffect, useRef, useState } from "react";
import { Json, str } from "@neurofence/contracts/types";
import { useConsole } from "../app/ConsoleContext";
import { Button } from "./Button";
import { Field, Fields } from "./Fields";
import { Icon } from "./Icon";

export function FormDialog({
  title,
  sub,
  fields,
  initial = {},
  onSubmit,
  submit = "Save",
  children,
}: {
  title: string;
  sub?: string;
  fields: Field[];
  initial?: Record<string, Json>;
  onSubmit: (body: Record<string, Json>) => Promise<void>;
  submit?: string;
  children?: ReactNode;
}) {
  const ctx = useConsole(),
    [values, setValues] = useState<Record<string, Json>>(() =>
      Object.fromEntries(
        fields.map((f) => [
          f.key,
          initial[f.key] ??
            f.default ??
            (f.type === "checkbox"
              ? false
              : f.type === "multi" || f.type === "ordered"
                ? []
                : ""),
        ]),
      ),
    ),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  return (
    <>
      <h2>{title}</h2>
      {sub && <p className="page-sub">{sub}</p>}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          setError("");
          try {
            await onSubmit(values);
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "The change could not be saved.",
            );
          } finally {
            setSaving(false);
          }
        }}
      >
        <Fields fields={fields} values={values} setValues={setValues} />
        {children}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <Button onClick={ctx.close}>Cancel</Button>
          <Button primary type="submit" disabled={saving}>
            {saving ? "Saving…" : submit}
          </Button>
        </div>
      </form>
    </>
  );
}

export function Confirm({
  title,
  description,
  onConfirm,
  verb = "Confirm",
}: {
  title: string;
  description: string;
  onConfirm: (reason: string) => Promise<void>;
  verb?: string;
}) {
  return (
    <FormDialog
      title={title}
      sub={description}
      fields={[
        { key: "reason", label: "Reason", type: "textarea", required: true },
      ]}
      onSubmit={(body) => onConfirm(str(body.reason))}
      submit={verb}
    />
  );
}

export function Modal({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const heading = ref.current?.querySelector("h2");
    if (heading) heading.id = "dialog-title";
    ref.current
      ?.querySelector<HTMLElement>("input,select,textarea,button")
      ?.focus();
  }, [children]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";
    const node = ref.current;
    const heading = node?.querySelector("h2");
    if (heading) heading.id = "dialog-title";
    node?.querySelector<HTMLElement>("input,select,textarea,button")?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const list = [
          ...node!.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea,a[href]",
          ),
        ].filter((n) => n.getClientRects().length);
        const first = list[0],
          last = list.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handler);
      previous?.isConnected && previous.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="dialog"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <button
          className="icon-button dialog-close"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
        <div className="dialog-content">{children}</div>
      </div>
    </div>
  );
}
