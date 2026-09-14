-- Run after infra/database/001_company_control.sql on an ephemeral PostgreSQL 16 database.
BEGIN;
INSERT INTO company_control.companies(tenant_id,slug,name,status,entitlements) VALUES
 ('00000000-0000-0000-0000-000000000001','company-one','One','Active',ARRAY['M9']),
 ('00000000-0000-0000-0000-000000000002','company-two','Two','Active',ARRAY['M9']);
INSERT INTO company_control.memberships(tenant_id,id,display_name,email,roles,status) VALUES
 ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Owner','owner@one.test',ARRAY['Company admin'],'Active'),
 ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','Reviewer','review@one.test',ARRAY['Security admin'],'Active');
INSERT INTO company_control.teams(tenant_id,id,name,department,cost_center) VALUES
 ('00000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','Other company team','Engineering','ENG');
CREATE ROLE company_test_request NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA company_control TO company_test_request;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA company_control TO company_test_request;
SET LOCAL ROLE company_test_request;
SELECT set_config('neurofence.tenant_id', '00000000-0000-0000-0000-000000000001', true);
DO $$
BEGIN
  IF (SELECT count(*) FROM company_control.companies) <> 1 THEN RAISE EXCEPTION 'Tenant reads are not isolated'; END IF;
  IF (SELECT count(*) FROM company_control.teams) <> 0 THEN RAISE EXCEPTION 'Other company team is visible'; END IF;
  BEGIN
    INSERT INTO company_control.teams(tenant_id,name,department,cost_center)
      VALUES ('00000000-0000-0000-0000-000000000002','Forbidden','Other','X');
    RAISE EXCEPTION 'Cross-company insertion was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO company_control.team_memberships(tenant_id,team_id,member_id) VALUES
      ('00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'Cross-company team reference was allowed';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO company_control.config_revisions(tenant_id,revision,document,status,author_id,reviewer_id,reason,published_at) VALUES
      ('00000000-0000-0000-0000-000000000001',1,'{}','Published','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Self approval',now());
    RAISE EXCEPTION 'Self approval was allowed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END;
$$;
INSERT INTO company_control.config_revisions(tenant_id,revision,document,status,author_id,reviewer_id,reason,published_at) VALUES
 ('00000000-0000-0000-0000-000000000001',1,'{}','Published','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','Independent approval',now());
INSERT INTO company_control.audit_events(tenant_id,actor_subject,event,detail) VALUES
 ('00000000-0000-0000-0000-000000000001','owner','Config published','{}');
DO $$
BEGIN
  BEGIN
    UPDATE company_control.config_revisions SET document = '{"changed":true}';
    RAISE EXCEPTION 'History mutation was allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Published configuration and audit history are immutable' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM company_control.audit_events;
    RAISE EXCEPTION 'Audit deletion was allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Audit events are immutable' THEN RAISE; END IF;
  END;
END;
$$;
SELECT set_config('neurofence.tenant_id', '', true);
DO $$
BEGIN
  IF (SELECT count(*) FROM company_control.companies) <> 0 THEN RAISE EXCEPTION 'Missing tenant context must return no rows'; END IF;
END;
$$;
ROLLBACK;
