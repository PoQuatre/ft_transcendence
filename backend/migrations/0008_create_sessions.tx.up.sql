SET statement_timeout = 0;
CREATE TABLE sessions (
    token TEXT PRIMARY KEY,
    data BYTEA NOT NULL, -- noqa: RF04
    expiry TIMESTAMPTZ NOT NULL
);
CREATE INDEX sessions_expiry_idx ON sessions (expiry);
