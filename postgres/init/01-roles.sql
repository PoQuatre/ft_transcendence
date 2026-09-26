-- 1. Create roles

CREATE ROLE app_readonly NOLOGIN;
CREATE ROLE app_readwrite NOLOGIN;
CREATE ROLE app_migrate NOLOGIN;
CREATE ROLE app_admin NOLOGIN;


-- 2. Role hierarchy

GRANT app_readonly TO app_readwrite;

GRANT app_readwrite TO app_admin;
GRANT app_migrate TO app_admin;


-- 3. Database / schema access

GRANT CONNECT
ON DATABASE postgres
TO app_readonly, app_readwrite, app_migrate, app_admin;

GRANT USAGE
ON SCHEMA public
TO app_readonly, app_readwrite, app_migrate, app_admin;


-- 4. Read-only access (existing tables)

GRANT SELECT
ON ALL TABLES IN SCHEMA public
TO app_readonly;


-- 5. Read-only access (future tables)

ALTER DEFAULT PRIVILEGES
FOR ROLE app_migrate
IN SCHEMA public
GRANT SELECT
ON TABLES
TO app_readonly;

ALTER DEFAULT PRIVILEGES
FOR ROLE app_admin
IN SCHEMA public
GRANT SELECT
ON TABLES
TO app_readonly;


-- 6. Read / write access (existing tables)

GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA public
TO app_readwrite;

GRANT USAGE, SELECT
ON ALL SEQUENCES IN SCHEMA public
TO app_readwrite;


-- 7. Read / write access (future tables)

ALTER DEFAULT PRIVILEGES
FOR ROLE app_migrate
IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLES
TO app_readwrite;

ALTER DEFAULT PRIVILEGES
FOR ROLE app_admin
IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLES
TO app_readwrite;

ALTER DEFAULT PRIVILEGES
FOR ROLE app_migrate
IN SCHEMA public
GRANT USAGE, SELECT
ON SEQUENCES
TO app_readwrite;

ALTER DEFAULT PRIVILEGES
FOR ROLE app_admin
IN SCHEMA public
GRANT USAGE, SELECT
ON SEQUENCES
TO app_readwrite;


-- 6. Migration role

GRANT USAGE, CREATE
ON SCHEMA public
TO app_migrate;
