-- Least-privilege application role for Alongside (TASK-004).
-- Prerequisites: PM has created the role (password never committed):
--   CREATE ROLE hypercare_app LOGIN PASSWORD '<pm-provided>';
-- Then run this script **twice** as `hypercare_admin` (SSM tunnel): once targeting
-- `hypercare_dev` and once targeting `hypercare_prod`. The database-level CONNECT
-- grants are idempotent; the table/sequence grants apply to the database you are
-- connected to. See docs/infra-runbook.md.

GRANT CONNECT ON DATABASE hypercare_dev TO hypercare_app;
GRANT CONNECT ON DATABASE hypercare_prod TO hypercare_app;

GRANT USAGE ON SCHEMA public TO hypercare_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hypercare_app;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hypercare_app;

ALTER DEFAULT PRIVILEGES FOR ROLE hypercare_admin IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hypercare_app;

ALTER DEFAULT PRIVILEGES FOR ROLE hypercare_admin IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO hypercare_app;
