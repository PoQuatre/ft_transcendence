SET statement_timeout = 0;

CREATE TABLE todos (
    id uuid NOT NULL DEFAULT uuidv7(),
    title varchar NOT NULL,
    completed boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT current_timestamp,
    updated_at timestamptz NOT NULL DEFAULT current_timestamp,
    PRIMARY KEY (id)
);
