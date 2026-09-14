const names = {
  "Company admin": "Divyan Kavdia",
  "Platform admin": "Divyan Kavdia",
  "Security admin": "Mira Kapoor",
  "Governance owner": "Ishaan Patel",
  "Platform engineer": "Rahul Mehta",
  Developer: "Priya Shah",
  "Agent owner": "Priya Shah",
  "FinOps owner": "Ananya Rao",
  "SOC analyst": "Neha Singh",
  Auditor: "Audit reviewer",
  "Neurofence operator": "Neurofence operator",
};
async function publishCompany(api, values, extra = {}) {
  const session = { ...api.session };
  const set = (role) =>
    api.setSession({
      ...session,
      role,
      user: names[role],
      permissions: undefined,
    });
  const get = async () => (await api.request({ path: "/api/v1/company" })).data;
  const send = async (action, body = {}) =>
    (
      await api.request({
        path: `/api/v1/company/config/${action}`,
        method: "POST",
        body,
        version: (await get()).version,
        idempotencyKey: crypto.randomUUID(),
      })
    ).data;
  try {
    set("Company admin");
    await send("draft", {
      values,
      ...extra,
      reason: "Exercise company configuration",
    });
    await send("validate");
    await send("submit");
    set("Security admin");
    await send("approve", { reason: "Independent test review" });
    set("Company admin");
    return await send("publish");
  } finally {
    api.setSession(session);
  }
}
module.exports = { names, publishCompany };
