import { useEffect, useState } from "react";
import {
  Company,
  ConfigOverride,
  EffectiveConfig,
  overrideKeys,
} from "@neurofence/contracts/company";
import { arr, Json, str, uid } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { Button } from "../../components/Button";
import { Confirm, FormDialog } from "../../components/dialogs";
import { Field, Fields } from "../../components/Fields";
import { Badge, Notice } from "../../components/feedback";
import { Panel } from "../../components/layout";
import { labels, lineFields, sections } from "./fields";

const show = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((v) => (typeof v === "object" ? JSON.stringify(v) : str(v)))
        .join(", ") || "None / unrestricted"
    : typeof value === "boolean"
      ? value
        ? "Yes"
        : "No"
      : str(value) || "Not configured";
const parseLines = (value: Json) =>
  str(value)
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
export function Configuration({
  company,
  identity = false,
}: {
  company: Company;
  identity?: boolean;
}) {
  const ctx = useConsole(),
    config = company.draft || company.config,
    row = { id: company.id, version: company.version };
  const [project, setProject] = useState("");
  const [effective, setEffective] = useState<EffectiveConfig>(
    ctx.state.company!.effective,
  );
  useEffect(() => {
    let current = true;
    void ctx
      .request<EffectiveConfig>({
        path: `/api/v1/company/effective${project ? "?project=" + encodeURIComponent(project) : ""}`,
      })
      .then((value) => {
        if (current) setEffective(value);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [project, company.version, ctx.session.environment]);
  const saveDraft = async (body: Record<string, Json>) => {
    await ctx.mutate("/api/v1/company/config/draft", body, row);
    ctx.close();
  };
  const edit = (name: string) => {
    const fields = sections[name];
    const initial: Record<string, Json> = { ...config.values, reason: "" };
    for (const key of lineFields)
      initial[key] = arr(config.values[key]).join("\n");
    initial.groupMappings = arr<Record<string, Json>>(
      config.values.groupMappings,
    )
      .map((m) => `${m.group}=${m.role}`)
      .join("\n");
    ctx.open(
      <FormDialog
        title={`Edit ${name.toLowerCase()}`}
        sub="Changes are saved as a draft and take effect after independent review and publication."
        fields={[
          ...fields,
          {
            key: "reason",
            label: "Change reason",
            type: "textarea",
            required: true,
          },
        ]}
        initial={initial}
        submit="Save draft"
        onSubmit={async (body) => {
          const values = { ...body };
          delete values.reason;
          for (const key of lineFields)
            if (values[key] !== undefined)
              values[key] = parseLines(values[key]);
          if (values.groupMappings !== undefined)
            values.groupMappings = str(values.groupMappings)
              .split("\n")
              .filter((s) => s.trim())
              .map((line) => {
                const at = line.lastIndexOf("=");
                return {
                  group: at < 0 ? "" : line.slice(0, at).trim(),
                  role: at < 0 ? "" : line.slice(at + 1).trim(),
                };
              });
          if (values.retention && values.retention !== "Full content")
            values.rawContent = false;
          await saveDraft({ values, reason: body.reason });
        }}
      />,
    );
  };
  const action = async (name: string, reason?: string) => {
    await ctx.mutate(
      `/api/v1/company/config/${name}`,
      reason ? { reason } : {},
      row,
    );
    ctx.close();
  };
  const draft = company.draft;
  return (
    <div className="stack">
      <Panel
        title="Configuration release"
        sub={`Published version ${company.publishedVersion} applies across the company. Drafts preserve the current running configuration.`}
      >
        <div className="row wrap">
          <Badge value={draft?.status || "Published"} />
          <span>{draft ? draft.reason : "No unpublished changes"}</span>
        </div>
        {draft && (
          <>
            <div className="company-diff">
              {Object.keys(draft.values)
                .filter(
                  (key) =>
                    JSON.stringify(draft.values[key]) !==
                    JSON.stringify(company.config.values[key]),
                )
                .map((key) => (
                  <div key={key}>
                    <strong>{labels[key] || key}</strong>
                    <span>
                      {key === "logo"
                        ? "Logo updated"
                        : `${show(company.config.values[key])} → ${show(draft.values[key])}`}
                    </span>
                  </div>
                ))}
              {JSON.stringify(draft.overrides) !==
                JSON.stringify(company.config.overrides) && (
                <p>Scoped overrides changed.</p>
              )}
              {JSON.stringify(draft.locked) !==
                JSON.stringify(company.config.locked) && (
                <p>Locked settings changed.</p>
              )}
              {JSON.stringify(draft.rolePermissions) !==
                JSON.stringify(company.config.rolePermissions) && (
                <p>Delegated role permissions changed.</p>
              )}
            </div>
            <div className="row wrap">
              <Button
                cap="company"
                disabled={draft.status !== "Draft"}
                onClick={() => void action("validate").catch(() => {})}
              >
                Validate draft
              </Button>
              <Button
                cap="company"
                disabled={draft.status !== "Validated"}
                onClick={() => void action("submit").catch(() => {})}
              >
                Request review
              </Button>
              <Button
                cap="companyReview"
                disabled={draft.status !== "Pending"}
                onClick={() =>
                  ctx.open(
                    <Confirm
                      title="Approve company configuration"
                      description="Review the full company draft and its overrides. The author cannot approve their own change."
                      verb="Approve configuration"
                      onConfirm={(reason) => action("approve", reason)}
                    />,
                  )
                }
              >
                Approve draft
              </Button>
              <Button
                cap="companyReview"
                disabled={draft.status !== "Pending"}
                onClick={() =>
                  ctx.open(
                    <Confirm
                      title="Return company configuration"
                      description="Return this draft to its author for changes."
                      verb="Return draft"
                      onConfirm={(reason) => action("reject", reason)}
                    />,
                  )
                }
              >
                Return for changes
              </Button>
              <Button
                cap="company"
                primary
                disabled={draft.status !== "Approved"}
                onClick={() => void action("publish").catch(() => {})}
              >
                Publish configuration
              </Button>
              <Button
                cap="company"
                onClick={() =>
                  ctx.open(
                    <Confirm
                      title="Discard company draft"
                      description="Published configuration remains active."
                      verb="Discard draft"
                      onConfirm={(reason) => action("discard", reason)}
                    />,
                  )
                }
              >
                Discard draft
              </Button>
            </div>
          </>
        )}
      </Panel>
      {identity && (
        <Notice>
          Identity provider settings and group mappings are ready to hand to an
          authentication adapter. This prototype continues to use explicit demo
          identities; configuring an issuer does not activate SSO.
        </Notice>
      )}
      <div className="company-grid">
        {Object.entries(sections)
          .filter(([name]) =>
            identity ? name === "Identity" : name !== "Identity",
          )
          .map(([name, fields]) => (
            <Panel
              key={name}
              title={name}
              actions={
                <Button cap="company" onClick={() => edit(name)}>
                  Edit {name.toLowerCase()}
                </Button>
              }
            >
              <dl className="company-values">
                {fields.map((field) => (
                  <div key={field.key}>
                    <dt>{field.label}</dt>
                    <dd>
                      {show(config.values[field.key])}
                      {config.locked.includes(field.key) && (
                        <span className="company-lock">Company locked</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              {name === "Company profile" && (
                <div className="row wrap company-logo-editor">
                  {config.values.logo && (
                    <img
                      src={str(config.values.logo)}
                      alt="Company logo preview"
                      width="48"
                      height="48"
                    />
                  )}
                  <Button
                    cap="company"
                    onClick={() =>
                      ctx.open(
                        <LogoForm
                          onSave={(logo) =>
                            saveDraft({
                              values: { logo },
                              reason: "Update company logo",
                            })
                          }
                        />,
                      )
                    }
                  >
                    Upload logo
                  </Button>
                  {!!config.values.logo && (
                    <Button
                      cap="company"
                      onClick={() =>
                        void saveDraft({
                          values: { logo: "" },
                          reason: "Remove company logo",
                        }).catch(() => {})
                      }
                    >
                      Remove logo
                    </Button>
                  )}
                </div>
              )}
            </Panel>
          ))}
      </div>
      {!identity && (
        <>
          <Panel
            title="Inheritance and locked controls"
            sub="Company defaults flow to teams, then environments, then applications. Locked values always retain the company default."
            actions={
              <>
                <Button
                  cap="company"
                  onClick={() =>
                    ctx.open(
                      <FormDialog
                        title="Lock company settings"
                        fields={[
                          {
                            key: "locked",
                            label: "Locked settings",
                            type: "multi",
                            options: overrideKeys.map((key) => [
                              key,
                              labels[key] || key,
                            ]),
                          },
                          {
                            key: "reason",
                            label: "Change reason",
                            type: "textarea",
                            required: true,
                          },
                        ]}
                        initial={{ locked: config.locked }}
                        submit="Save draft"
                        onSubmit={saveDraft}
                      />,
                    )
                  }
                >
                  Manage locks
                </Button>
                <Button
                  cap="company"
                  onClick={() =>
                    ctx.open(
                      <OverrideForm company={company} onSave={saveDraft} />,
                    )
                  }
                >
                  Add scoped override
                </Button>
              </>
            }
          >
            {config.overrides.length ? (
              <div className="stack">
                {config.overrides.map((override) => (
                  <div className="company-override" key={override.id}>
                    <div>
                      <strong>
                        {override.scope} · {override.target}
                      </strong>
                      <p>
                        {Object.entries(override.values)
                          .map(
                            ([key, value]) =>
                              `${labels[key] || key}: ${show(value)}`,
                          )
                          .join("; ")}
                      </p>
                    </div>
                    <Button
                      cap="company"
                      onClick={() =>
                        void saveDraft({
                          overrides: config.overrides.filter(
                            (o) => o.id !== override.id,
                          ) as unknown as Json,
                          reason: `Remove ${override.scope} override for ${override.target}`,
                        }).catch(() => {})
                      }
                    >
                      Remove override
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p>Every scope currently inherits company defaults.</p>
            )}
          </Panel>
          <Panel
            title="Effective configuration"
            sub="This view reads published values from the backend, including the source of each inherited setting."
          >
            <label className="field">
              Preview application
              <select
                aria-label="Effective configuration application"
                value={project}
                onChange={(e) => setProject(e.target.value)}
              >
                <option value="">{ctx.session.environment} defaults</option>
                {ctx.state.data.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {str(p.name)}
                  </option>
                ))}
              </select>
            </label>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Setting</th>
                    <th>Effective value</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {overrideKeys.map((key) => (
                    <tr key={key}>
                      <td>{labels[key] || key}</td>
                      <td>{show(effective.values[key])}</td>
                      <td>
                        {effective.locked.includes(key)
                          ? "Locked by company"
                          : effective.sources[key]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

function LogoForm({ onSave }: { onSave: (logo: string) => Promise<void> }) {
  const ctx = useConsole(),
    [logo, setLogo] = useState(""),
    [error, setError] = useState("");
  return (
    <>
      <h2>Company logo</h2>
      <p>PNG, JPEG or WebP, up to 180 KB.</p>
      <input
        type="file"
        aria-label="Company logo file"
        accept="image/png,image/jpeg,image/webp"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setLogo("");
          setError("");
          if (
            file.size > 180000 ||
            !["image/png", "image/jpeg", "image/webp"].includes(file.type)
          ) {
            setError("Choose a PNG, JPEG or WebP under 180 KB.");
            return;
          }
          const reader = new FileReader();
          reader.onload = () => setLogo(str(reader.result));
          reader.onerror = () => setError("The logo could not be read.");
          reader.readAsDataURL(file);
        }}
      />
      {logo && (
        <img src={logo} alt="Selected company logo" width="96" height="96" />
      )}
      {error && <p role="alert">{error}</p>}
      <div className="dialog-actions">
        <Button onClick={ctx.close}>Cancel</Button>
        <Button
          primary
          disabled={!logo}
          onClick={() => void onSave(logo).catch((e) => setError(e.message))}
        >
          Save logo draft
        </Button>
      </div>
    </>
  );
}

function OverrideForm({
  company,
  onSave,
}: {
  company: Company;
  onSave: (body: Record<string, Json>) => Promise<void>;
}) {
  const ctx = useConsole(),
    config = company.draft || company.config;
  const defaultKey =
    overrideKeys
      .filter((key) => !config.locked.includes(key))
      .find((key) => key === "maxTokens") ||
    overrideKeys.find((key) => !config.locked.includes(key)) ||
    "maxTokens";
  const [scope, setScope] = useState<ConfigOverride["scope"]>("environment"),
    [target, setTarget] = useState(ctx.session.environment),
    [key, setKey] = useState(defaultKey),
    [values, setValues] = useState<Record<string, Json>>({
      value: config.values[defaultKey],
      reason: "",
    }),
    [error, setError] = useState("");
  const base = Object.values(sections)
    .flat()
    .find((f) => f.key === key)!;
  const field: Field = { ...base, key: "value" };
  const targets =
    scope === "environment"
      ? company.environments.map((e) => [e, e])
      : scope === "team"
        ? company.teams.map((t) => [t.id, t.name])
        : ctx.state.data.projects.map((p) => [p.id, str(p.name)]);
  return (
    <>
      <h2>Add scoped override</h2>
      <p>
        Application overrides apply in {ctx.session.environment}. Add multiple
        settings by selecting the same scope again.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          const value = lineFields.includes(key)
            ? parseLines(values.value)
            : values.value;
          const previous = config.overrides.find(
            (o) =>
              o.scope === scope &&
              o.target === target &&
              (scope !== "project" ||
                o.environment === ctx.session.environment),
          );
          const override: ConfigOverride = {
            id: previous?.id || uid("override"),
            scope,
            target,
            environment: scope === "project" ? ctx.session.environment : "",
            values: { ...previous?.values, [key]: value },
          };
          try {
            await onSave({
              overrides: [
                ...config.overrides.filter((o) => o.id !== override.id),
                override,
              ] as unknown as Json,
              reason: values.reason,
            });
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <div className="form-grid">
          <label className="field">
            Scope
            <select
              aria-label="Override scope"
              value={scope}
              onChange={(e) => {
                setScope(e.target.value as ConfigOverride["scope"]);
                setTarget("");
              }}
            >
              <option value="environment">Environment</option>
              <option value="team">Team</option>
              <option value="project">Application</option>
            </select>
          </label>
          <label className="field">
            Override target
            <select
              aria-label="Override target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              required
            >
              <option value="">Select…</option>
              {targets.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Setting
            <select
              aria-label="Override setting"
              value={key}
              onChange={(e) => {
                const k = e.target.value;
                setKey(k);
                setValues({
                  ...values,
                  value: lineFields.includes(k)
                    ? arr(config.values[k]).join("\n")
                    : config.values[k],
                });
              }}
            >
              {overrideKeys
                .filter((k) => !config.locked.includes(k))
                .map((k) => (
                  <option key={k} value={k}>
                    {labels[k] || k}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <Fields
          fields={[
            field,
            {
              key: "reason",
              label: "Change reason",
              type: "textarea",
              required: true,
            },
          ]}
          values={values}
          setValues={setValues}
        />
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <Button onClick={ctx.close}>Cancel</Button>
          <Button type="submit" primary>
            Save override draft
          </Button>
        </div>
      </form>
    </>
  );
}
