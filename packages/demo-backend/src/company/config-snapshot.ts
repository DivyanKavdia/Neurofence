import { CompanyConfig } from "@neurofence/contracts/company";

export const snapshot = (config: CompanyConfig): CompanyConfig =>
  structuredClone({
    values: config.values,
    locked: config.locked,
    overrides: config.overrides,
    rolePermissions: config.rolePermissions,
  });
