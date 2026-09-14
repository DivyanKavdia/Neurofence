import { ApiError, arr, can, obj, str, uid } from "@neurofence/contracts/types";
import {
  inspectionDecisions,
  inspectionStages,
  PolicyCase,
  PolicySuite,
  PolicyTestRun,
} from "@neurofence/contracts/policy-lab";
import { RequestContext } from "../context";
import { inspect } from "../execution/inspect";
import { canonical, hash, requireValue } from "../shared/values";
import { resolveMembership } from "../company/directory";

/** Bounded synthetic inputs; execution uses the same inspection engine as the gateway. */
export function parsePolicyCases(value: unknown): PolicyCase[] {
  requireValue(
    Array.isArray(value) && value.length > 0 && value.length <= 30,
    "A suite needs 1–30 test cases.",
  );
  const cases = arr<PolicyCase>(value);
  requireValue(
    cases.every((c) => c && typeof c === "object" && !Array.isArray(c)),
    "Invalid test case.",
  );
  requireValue(
    new Set(cases.map((c) => c.id)).size === cases.length,
    "Test case identifiers must be unique.",
  );
  requireValue(
    cases.reduce((n, c) => n + str(c.text).length, 0) <= 24000,
    "A suite can contain at most 24,000 input characters.",
  );
  return cases.map((c) => {
    requireValue(
      Object.keys(c).every((k) =>
        ["id", "name", "stage", "text", "expected", "forbiddenText"].includes(
          k,
        ),
      ),
      "Unknown test case field.",
    );
    requireValue(
      typeof c.id === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(c.id),
      "Use a short, unique test case identifier.",
    );
    requireValue(
      typeof c.name === "string" &&
        c.name.trim().length > 0 &&
        c.name.length <= 120,
      "Each case needs a name of at most 120 characters.",
    );
    requireValue(
      inspectionStages.includes(c.stage),
      "Choose a supported inspection stage.",
    );
    requireValue(
      inspectionDecisions.includes(c.expected),
      "Choose an expected decision.",
    );
    requireValue(
      typeof c.text === "string" &&
        c.text.trim().length > 0 &&
        c.text.length <= 8000,
      "Each input needs 1–8,000 characters.",
    );
    requireValue(
      typeof c.forbiddenText === "string" && c.forbiddenText.length <= 200,
      "The output exclusion must be at most 200 characters.",
    );
    return {
      id: c.id,
      name: c.name.trim(),
      stage: c.stage,
      text: c.text,
      expected: c.expected,
      forbiddenText: c.forbiddenText,
    };
  });
}

export async function handlePolicyLab(ctx: RequestContext) {
  if (ctx.resource !== "policy-tests") return;
  const { state, body, id, action, method, session } = ctx;
  requireValue(
    arr(state.settings.modules).includes("M3"),
    "Enable Guardrails to use policy tests.",
  );
  ctx.permission(can(session, "policies") ? "policies" : "run");
  const owner = resolveMembership(ctx.company, session).id;
  const lab = (state.policyLab ||= { suites: [], runs: [] });
  const visible = lab.suites.filter(
    (s) => s.owner === owner || can(session, "policies"),
  );
  const fingerprint = async (suite: PolicySuite) =>
    hash(
      canonical(
        JSON.parse(
          JSON.stringify({
            engine: 1,
            suite,
            policy: ctx.find("policies", suite.policy),
            detectors: state.data.detectors,
            company: ctx.company.publishedVersion,
            settings: state.settings,
          }),
        ),
      ),
    );
  if (method === "GET" && !id) {
    const current = new Map(
      await Promise.all(
        visible.map(async (s) => [s.id, await fingerprint(s)] as const),
      ),
    );
    return ctx.respond({
      suites: visible,
      runs: lab.runs
        .filter((r) => current.has(r.suite))
        .map((r) => ({ ...r, stale: r.fingerprint !== current.get(r.suite) })),
    });
  }
  const suite = id ? visible.find((s) => s.id === id) : undefined;
  if (id && !suite)
    throw new ApiError(
      404,
      "NOT_FOUND",
      "This test suite is unavailable in your scope.",
    );
  if (suite) ctx.checkVersion({ id: suite.id, version: suite.version });
  if (method === "DELETE" && suite && !action) {
    lab.suites = lab.suites.filter((s) => s.id !== id);
    lab.runs = lab.runs.filter((r) => r.suite !== id);
    ctx.audit("Policy test suite deleted", suite.name, id);
    return ctx.respond({ deleted: id });
  }
  if ((method === "POST" && !id) || (method === "PATCH" && suite && !action)) {
    requireValue(
      Object.keys(body).every((k) =>
        ["name", "policy", "syntheticOnly", "cases"].includes(k),
      ),
      "Unknown test suite field.",
    );
    requireValue(
      body.syntheticOnly === true,
      "Confirm that saved inputs contain synthetic demo data only.",
    );
    requireValue(
      typeof body.name === "string" &&
        body.name.trim().length > 0 &&
        body.name.length <= 100,
      "Give the suite a name of at most 100 characters.",
    );
    ctx.find("policies", str(body.policy));
    requireValue(
      !!suite || lab.suites.length < 12,
      "This environment already contains 12 suites. Remove an unused suite first.",
    );
    const saved: PolicySuite = {
      id: suite?.id || uid("suite"),
      version: (suite?.version || 0) + 1,
      name: str(body.name).trim(),
      policy: str(body.policy),
      owner: suite?.owner || owner,
      updatedAt: Date.now(),
      syntheticOnly: true,
      cases: parsePolicyCases(body.cases),
    };
    lab.suites = [saved, ...lab.suites.filter((s) => s.id !== saved.id)];
    ctx.audit(
      suite ? "Policy test suite updated" : "Policy test suite created",
      saved.name,
      saved.id,
    );
    return ctx.respond(saved);
  }
  if (method === "POST" && suite && action === "run") {
    requireValue(
      Object.keys(body).length === 0,
      "Run the saved suite; save input changes first.",
    );
    const policy = ctx.find("policies", suite.policy);
    requireValue(
      ["Active", "Canary"].includes(str(policy.status)),
      "The baseline policy must be published before comparison.",
    );
    const candidate = { ...policy, ...obj(policy.draft) };
    const results = suite.cases.map((c) => {
      const evaluate = (p: typeof policy) => {
        const effective = { ...p };
        if (["Response", "Tool result"].includes(c.stage))
          effective.pii = effective.responseAction || effective.pii;
        const result = inspect(c.text, effective, state, c.stage);
        const output = result.decision === "DENY" ? "" : result.text;
        return {
          decision: result.decision,
          output: output.slice(0, 500),
          reason: result.reason,
          rules: [
            ...new Set(result.findings.map((f) => `${f.detector}:${f.rule}`)),
          ].slice(0, 30),
          matches: result.findings.length,
          passed:
            result.decision === c.expected &&
            (!c.forbiddenText || !output.includes(c.forbiddenText)),
          fullOutput: output,
        };
      };
      const a = evaluate(policy),
        b = evaluate(candidate);
      const changed =
        a.decision !== b.decision ||
        a.fullOutput !== b.fullOutput ||
        canonical(a.rules) !== canonical(b.rules);
      const { fullOutput: _activeOutput, ...active } = a,
        { fullOutput: _candidateOutput, ...next } = b;
      return {
        id: c.id,
        name: c.name,
        stage: c.stage,
        expected: c.expected,
        active,
        candidate: next,
        changed,
        regression: a.passed && !b.passed,
      };
    });
    const run: PolicyTestRun = {
      id: uid("test-run"),
      suite: suite.id,
      suiteVersion: suite.version,
      policy: suite.policy,
      policyVersion: Number(policy.publishedVersion || policy.version),
      companyVersion: ctx.company.publishedVersion,
      hasDraft: Object.keys(obj(policy.draft)).length > 0,
      fingerprint: await fingerprint(suite),
      ts: Date.now(),
      actor: session.user,
      changed: results.filter((r) => r.changed).length,
      failures: results.filter((r) => !r.candidate.passed).length,
      regressions: results.filter((r) => r.regression).length,
      results,
    };
    lab.runs = [run, ...lab.runs].slice(0, 20);
    ctx.audit(
      "Policy comparison completed",
      `${suite.name}; ${run.failures} failed expectations, ${run.regressions} new failures`,
      run.id,
    );
    return ctx.respond(run);
  }
  throw new ApiError(404, "UNKNOWN_ACTION", "Unsupported policy test action.");
}
