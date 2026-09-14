-- PostgreSQL 16 production handoff. Run with a migration owner, never the request role.
-- This schema is intentionally separate from the prototype browser/file store.
BEGIN;
CREATE SCHEMA IF NOT EXISTS company_control;

CREATE TABLE company_control.companies (
  tenant_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL CHECK (slug ~ '^[a-z][a-z0-9-]{2,47}$'),
  name text NOT NULL,
  status text NOT NULL CHECK (status IN ('Onboarding', 'Active', 'Suspended')),
  entitlements text[] NOT NULL,
  published_version bigint NOT NULL DEFAULT 1,
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE company_control.environments (
  tenant_id uuid NOT NULL REFERENCES company_control.companies(tenant_id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  PRIMARY KEY (tenant_id, id), UNIQUE (tenant_id, name)
);
CREATE TABLE company_control.memberships (
  tenant_id uuid NOT NULL REFERENCES company_control.companies(tenant_id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  email text NOT NULL,
  identity_issuer text,
  external_subject text,
  roles text[] NOT NULL CHECK (
    cardinality(roles) > 0 AND roles <@ ARRAY['Company admin','Platform admin','Security admin',
    'Governance owner','Platform engineer','Developer','Agent owner','FinOps owner','SOC analyst','Auditor']::text[]
  ),
  status text NOT NULL CHECK (status IN ('Invited', 'Active', 'Suspended')),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, identity_issuer, external_subject),
  CHECK ((identity_issuer IS NULL) = (external_subject IS NULL))
);
CREATE UNIQUE INDEX memberships_email ON company_control.memberships(tenant_id, lower(email));
CREATE TABLE company_control.teams (
  tenant_id uuid NOT NULL REFERENCES company_control.companies(tenant_id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  department text NOT NULL,
  cost_center text NOT NULL,
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, id), UNIQUE (tenant_id, name)
);
CREATE TABLE company_control.team_memberships (
  tenant_id uuid NOT NULL,
  team_id uuid NOT NULL,
  member_id uuid NOT NULL,
  PRIMARY KEY (tenant_id, team_id, member_id),
  FOREIGN KEY (tenant_id, team_id) REFERENCES company_control.teams(tenant_id, id),
  FOREIGN KEY (tenant_id, member_id) REFERENCES company_control.memberships(tenant_id, id)
);
CREATE TABLE company_control.config_revisions (
  tenant_id uuid NOT NULL REFERENCES company_control.companies(tenant_id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  revision bigint NOT NULL,
  version bigint NOT NULL DEFAULT 1,
  document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object'),
  status text NOT NULL CHECK (status IN ('Draft', 'Validated', 'Pending', 'Approved', 'Published', 'Discarded')),
  author_id uuid NOT NULL,
  reviewer_id uuid,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  PRIMARY KEY (tenant_id, id), UNIQUE (tenant_id, revision),
  FOREIGN KEY (tenant_id, author_id) REFERENCES company_control.memberships(tenant_id, id),
  FOREIGN KEY (tenant_id, reviewer_id) REFERENCES company_control.memberships(tenant_id, id),
  CHECK (status NOT IN ('Approved', 'Published') OR (reviewer_id IS NOT NULL AND reviewer_id <> author_id)),
  CHECK (status <> 'Published' OR published_at IS NOT NULL)
);
CREATE TABLE company_control.provisioning_requests (
  tenant_id uuid NOT NULL REFERENCES company_control.companies(tenant_id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  environment_id uuid NOT NULL,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'Requested' CHECK (status IN ('Requested', 'Ready for provisioning', 'Rejected')),
  requested_by uuid NOT NULL,
  details text NOT NULL,
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, environment_id) REFERENCES company_control.environments(tenant_id, id),
  FOREIGN KEY (tenant_id, requested_by) REFERENCES company_control.memberships(tenant_id, id)
);
CREATE TABLE company_control.audit_events (
  tenant_id uuid NOT NULL REFERENCES company_control.companies(tenant_id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_subject text NOT NULL,
  event text NOT NULL,
  detail jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);
CREATE TABLE company_control.outbox (
  tenant_id uuid NOT NULL REFERENCES company_control.companies(tenant_id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  config_version bigint,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  PRIMARY KEY (tenant_id, id)
);
CREATE TABLE company_control.request_receipts (
  tenant_id uuid NOT NULL REFERENCES company_control.companies(tenant_id),
  actor_subject text NOT NULL,
  request_key text NOT NULL,
  payload_hash text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, actor_subject, request_key)
);

CREATE FUNCTION company_control.protect_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'audit_events' OR OLD.status = 'Published' THEN
    RAISE EXCEPTION 'Published configuration and audit history are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_published_config BEFORE UPDATE OR DELETE ON company_control.config_revisions
  FOR EACH ROW EXECUTE FUNCTION company_control.protect_history();
-- Separate function because audit rows have no status field.
CREATE FUNCTION company_control.protect_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit events are immutable'; END;
$$;
CREATE TRIGGER protect_audit BEFORE UPDATE OR DELETE ON company_control.audit_events
  FOR EACH ROW EXECUTE FUNCTION company_control.protect_audit();

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['companies','environments','memberships','teams','team_memberships',
    'config_revisions','provisioning_requests','audit_events','outbox','request_receipts'] LOOP
    EXECUTE format('ALTER TABLE company_control.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE company_control.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY tenant_boundary ON company_control.%I USING (tenant_id = nullif(current_setting(''neurofence.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''neurofence.tenant_id'', true), '''')::uuid)', table_name);
  END LOOP;
END;
$$;
REVOKE ALL ON SCHEMA company_control FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA company_control FROM PUBLIC;
-- Grant only required operations to a non-owner, non-superuser, NOBYPASSRLS request role.
-- In a transaction, after verifying identity + membership:
-- SELECT set_config('neurofence.tenant_id', $1, true); -- transaction-local UUID
-- Commit config, audit, idempotency receipt and outbox event in that same transaction.
COMMIT;
