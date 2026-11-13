SET statement_timeout = 0;
CREATE TABLE friend_relations (
    id BIGSERIAL NOT NULL, user_id UUID NOT NULL, friend_id UUID NOT NULL, PRIMARY KEY (id)
);
