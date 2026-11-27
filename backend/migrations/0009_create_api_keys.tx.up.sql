CREATE TABLE api_keys (
    user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    key_hash text NOT NULL UNIQUE,
    prefix text NOT NULL, -- noqa: RF04
    created_at timestamptz NOT NULL DEFAULT current_timestamp,
    last_used_at timestamptz
);
