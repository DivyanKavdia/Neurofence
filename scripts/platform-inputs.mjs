import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
const target = "infra/terraform/platform/terraform.tfvars.json";
if (existsSync(target))
  throw new Error(`${target} already exists; review it before replacing it.`);
const output = JSON.parse(
  execFileSync("terraform", ["-chdir=infra/terraform/aws", "output", "-json"], {
    encoding: "utf8",
  }),
);
const inputs = {
  region: output.region.value,
  cluster_name: output.cluster_name.value,
  runtime_role_arn: output.runtime_role_arn.value,
  clickhouse_secret_arn: output.application_secret_refs.value.clickhouse,
  vpc_cidr: output.vpc_cidr.value,
};
writeFileSync(target, JSON.stringify(inputs, null, 2) + "\n", {
  mode: 0o600,
  flag: "wx",
});
console.log(
  `Wrote ${target}. Review the values before planning the platform root.`,
);
