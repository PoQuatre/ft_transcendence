SET statement_timeout = 0;
CREATE TABLE friend_message (
    id BIGSERIAL NOT NULL,
    sender_id UUID NOT NULL,
    receiver_id UUID NOT NULL,
    content VARCHAR NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    PRIMARY KEY (id)
);
