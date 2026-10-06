SET statement_timeout = 0;
CREATE TABLE users (
    id uuid NOT NULL DEFAULT uuidv7(),
    username varchar NOT NULL,
    email varchar NOT NULL,
    password_hash varchar NOT NULL,
    created_at timestamptz NOT NULL DEFAULT current_timestamp,
    updated_at timestamptz NOT NULL DEFAULT current_timestamp,
    PRIMARY KEY (id),
    UNIQUE (username),
    UNIQUE (email)
);
