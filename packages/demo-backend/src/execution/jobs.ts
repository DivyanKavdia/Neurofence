import {
  arr,
  Collection,
  num,
  round,
  State,
  str,
  uid,
} from "@neurofence/contracts/types";

export function completeJobs(
  state: State,
  audit: (e: string, d: string, r?: string) => void,
) {
  if (arr(state.settings.modules).includes("M7"))
    for (const campaign of state.data.campaigns) {
      if (
        !campaign.scheduleEnabled ||
        num(campaign.nextRunAt) > Date.now() ||
        campaign.status === "Running"
      )
        continue;
      campaign.nextRunAt =
        Date.now() + (campaign.schedule === "Weekly" ? 7 : 1) * 86400000;
      campaign.status = "Running";
      campaign.version++;
      campaign.jobId = uid("job");
      state.data.jobs.push({
        id: str(campaign.jobId),
        version: 1,
        collection: "campaigns",
        resource: campaign.id,
        status: "Running",
        progress: 0,
        startedAt: Date.now(),
        readyAt: Date.now() + 900,
      });
      audit(
        "Started scheduled sample campaign",
        str(campaign.name),
        campaign.id,
      );
    }
  for (const job of state.data.jobs.filter((j) => j.status === "Running")) {
    job.progress = Math.min(
      95,
      Math.round(
        ((Date.now() - num(job.startedAt)) /
          Math.max(1, num(job.readyAt) - num(job.startedAt))) *
          100,
      ),
    );
    if (num(job.readyAt) > Date.now()) continue;
    const collection = str(job.collection) as Collection,
      target = state.data[collection]?.find((r) => r.id === job.resource);
    if (!target) {
      job.status = "Cancelled";
      continue;
    }
    if (collection === "traces") {
      target.cost = round(num(target.cost) * 0.6);
      target.reservation = 0;
      target.pendingCost = false;
      target.reason = "Provider timeout reconciled from sample usage";
    } else {
      const pass = !!target.remediation;
      target.status = pass ? "Passed" : "Failed";
      target.findings = pass
        ? []
        : [
            {
              severity: "High",
              title:
                collection === "scans"
                  ? "Unverified sample dependency"
                  : "Prompt injection regression",
              evidence: "Synthetic adverse case",
              remediation: "Bind and retest the baseline protection",
            },
          ];
      target.runHistory = [
        ...arr(target.runHistory),
        {
          ts: Date.now(),
          status: target.status,
          findings: target.findings,
          remediation: target.remediation || "",
        },
      ];
      target.gate = pass ? "Ready" : "Blocked";
      if (collection === "scans" && pass && target.digest) {
        target.approvedDigest = target.digest;
        target.provenance = "Reviewed sample provenance";
      }
      if (!pass)
        state.data.incidents.unshift({
          id: uid("INC"),
          version: 1,
          title: `${target.name}: assurance gate failed`,
          source: collection === "scans" ? "Supply chain" : "Red team",
          severity: "High",
          project: target.target || "",
          status: "Open",
          owner: "Security team",
          ts: Date.now(),
          reason:
            "Review sample exploit evidence, link remediation and retest.",
          notes: [],
          assurance: target.id,
        });
    }
    target.version++;
    job.status = "Completed";
    job.progress = 100;
    job.version++;
    audit("Completed sample job", str(target.name || target.id), target.id);
  }
}
