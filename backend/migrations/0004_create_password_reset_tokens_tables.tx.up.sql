SET statement_timeout
= 0;
CREATE TABLE password_reset_tokens (
    id uuid NOT NULL DEFAULT uuidv7(),
    user_id uuid NOT NULL,
    token_hash varchar NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT current_timestamp,
    PRIMARY KEY (id),
    UNIQUE (token_hash)
);
