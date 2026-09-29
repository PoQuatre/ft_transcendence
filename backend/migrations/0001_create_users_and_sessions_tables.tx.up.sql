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
CREATE TABLE sessions (
    id varchar NOT NULL,
    user_id uuid NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT current_timestamp,
    PRIMARY KEY (id)
);
ALTER TABLE public.sessions ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (
    user_id
) REFERENCES public.users (id);
