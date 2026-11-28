SET statement_timeout
= 0;
CREATE TABLE new_mail_verifications (
    user_id uuid NOT NULL,
    code varchar NOT NULL,
    email varchar NOT NULL,
    ends_at timestamptz NOT NULL,
    PRIMARY KEY (user_id)
);
