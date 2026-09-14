import { useState } from "react";
import { Company, moduleOptions } from "@neurofence/contracts/company";
import { Json, str } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { Button } from "../../components/Button";
import { Fields, Field } from "../../components/Fields";
import { Notice } from "../../components/feedback";

export function Onboarding() {
  const ctx = useConsole();
  const [step, setStep] = useState(0),
    [error, setError] = useState("");
  const [values, setValues] = useState<Record<string, Json>>({
    slug: "",
    name: "",
    ownerName: "",
    ownerEmail: "",
    environments: ["Development", "Staging", "Production"],
    entitlements: moduleOptions.map(([id]) => id),
  });
  const steps = ["Company", "First admin", "Modules", "Review"];
  const fields: Field[][] = [
    [
      { key: "name", label: "Company name", required: true },
      {
        key: "slug",
        label: "Company identifier",
        required: true,
        help: "3–48 lowercase letters, numbers or hyphens. This identifier cannot be renamed.",
      },
      {
        key: "environments",
        label: "Initial environments",
        type: "multi",
        options: ["Development", "Staging", "Production"],
      },
    ],
    [
      { key: "ownerName", label: "First administrator name", required: true },
      { key: "ownerEmail", label: "First administrator email", required: true },
    ],
    [
      {
        key: "entitlements",
        label: "Company entitlements",
        type: "multi",
        options: moduleOptions.map(([id, name]) => [id, `${id} · ${name}`]),
      },
    ],
  ];
  return (
    <>
      <h2>Onboard a company</h2>
      <p className="page-sub">
        Create an isolated company and hand its setup to the first
        administrator.
      </p>
      <ol className="company-steps">
        {steps.map((name, i) => (
          <li key={name} aria-current={i === step ? "step" : undefined}>
            <span>{i + 1}</span>
            {name}
          </li>
        ))}
      </ol>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          if (step < 3) {
            setStep(step + 1);
            return;
          }
          try {
            const company = await ctx.mutate<Company>(
              "/api/v1/companies",
              values,
            );
            ctx.setSession({
              tenant: company.id,
              environment: company.environments[0],
              region: "India",
              role: "Company admin",
              user: company.members[0].name,
            });
            ctx.go("company", "Overview");
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        {step < 3 ? (
          <Fields fields={fields[step]} values={values} setValues={setValues} />
        ) : (
          <div className="stack">
            <h3>{str(values.name)}</h3>
            <p>
              {str(values.slug)} · {str(values.ownerName)} ·{" "}
              {str(values.ownerEmail)}
            </p>
            <p>Environments: {(values.environments as string[]).join(", ")}</p>
            <p>Entitlements: {(values.entitlements as string[]).join(", ")}</p>
            <Notice>
              The first admin is activated in this demo. No invitation is sent.
              They will add an independent reviewer and finish company setup.
            </Notice>
          </div>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <Button onClick={() => (step ? setStep(step - 1) : ctx.close())}>
            {step ? "Back" : "Cancel"}
          </Button>
          <Button type="submit" primary>
            {step === 3 ? "Create company" : "Continue"}
          </Button>
        </div>
      </form>
    </>
  );
}
