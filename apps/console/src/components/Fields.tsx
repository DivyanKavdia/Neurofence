import { useId } from "react";
import { arr, Json, num, str } from "@neurofence/contracts/types";

export type Field = {
  key: string;
  label: string;
  type?:
    | "text"
    | "number"
    | "textarea"
    | "select"
    | "checkbox"
    | "multi"
    | "datetime"
    | "ordered";
  options?: (string | [string, string])[];
  required?: boolean;
  min?: number;
  max?: number;
  help?: string;
  default?: Json;
};

export function Fields({
  fields,
  values,
  setValues,
}: {
  fields: Field[];
  values: Record<string, Json>;
  setValues: (values: Record<string, Json>) => void;
}) {
  const id = useId(),
    set = (key: string, value: Json) => setValues({ ...values, [key]: value });
  return (
    <div className="form-grid">
      {fields.map((f) => {
        const value =
            values[f.key] ??
            f.default ??
            (f.type === "checkbox"
              ? false
              : f.type === "multi" || f.type === "ordered"
                ? []
                : ""),
          fid = `${id}-${f.key}`;
        return (
          <div
            className={`field ${["textarea", "multi", "ordered"].includes(f.type || "") ? "full" : ""}`}
            key={f.key}
          >
            <label htmlFor={fid}>
              {f.label}
              {f.required ? " *" : ""}
            </label>
            {f.type === "select" ? (
              <select
                id={fid}
                value={str(value)}
                required={f.required}
                onChange={(e) => set(f.key, e.target.value)}
              >
                <option value="">Select…</option>
                {f.options?.map((o) => (
                  <option
                    key={Array.isArray(o) ? o[0] : o}
                    value={Array.isArray(o) ? o[0] : o}
                  >
                    {Array.isArray(o) ? o[1] : o}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                id={fid}
                value={str(value)}
                required={f.required}
                rows={4}
                onChange={(e) => set(f.key, e.target.value)}
              />
            ) : f.type === "checkbox" ? (
              <input
                id={fid}
                type="checkbox"
                checked={!!value}
                onChange={(e) => set(f.key, e.target.checked)}
              />
            ) : f.type === "multi" || f.type === "ordered" ? (
              <div className="check-grid" role="group" aria-label={f.label}>
                {f.options?.map((o) => {
                  const key = Array.isArray(o) ? o[0] : o;
                  return (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={arr(value).includes(key)}
                        onChange={(e) =>
                          set(
                            f.key,
                            e.target.checked
                              ? [...arr(value), key]
                              : arr(value).filter((v) => v !== key),
                          )
                        }
                      />
                      {Array.isArray(o) ? o[1] : o}
                    </label>
                  );
                })}
                {f.type === "ordered" && (
                  <ol className="pipeline-order">
                    {arr<string>(value).map((key, i) => (
                      <li key={key}>
                        {key}
                        <button
                          type="button"
                          disabled={!i}
                          aria-label={`Move ${key} earlier`}
                          onClick={() => {
                            const list = arr<string>(value).slice();
                            [list[i - 1], list[i]] = [list[i], list[i - 1]];
                            set(f.key, list);
                          }}
                        >
                          ↑
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ) : (
              <input
                id={fid}
                type={
                  f.type === "datetime" ? "datetime-local" : f.type || "text"
                }
                value={
                  f.type === "datetime" && value
                    ? new Date(
                        num(value) - new Date().getTimezoneOffset() * 60000,
                      )
                        .toISOString()
                        .slice(0, 16)
                    : str(value)
                }
                min={f.min}
                max={f.max}
                step={f.type === "number" ? "any" : undefined}
                required={f.required}
                onChange={(e) =>
                  set(
                    f.key,
                    f.type === "number"
                      ? num(e.target.value)
                      : f.type === "datetime"
                        ? new Date(e.target.value).getTime()
                        : e.target.value,
                  )
                }
              />
            )}
            {f.help && <span className="field-help">{f.help}</span>}
          </div>
        );
      })}
    </div>
  );
}
