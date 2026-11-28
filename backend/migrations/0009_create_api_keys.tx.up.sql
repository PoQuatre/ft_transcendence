SET statement_timeout = 0;

CREATE TABLE api_keys (
    user_id uuid NOT NULL,
    key_hash varchar NOT NULL,
    prefix varchar NOT NULL, -- noqa: RF04
    created_at timestamptz NOT NULL DEFAULT current_timestamp,
    last_used_at timestamptz,
    PRIMARY KEY (user_id),
    UNIQUE (key_hash)
);
