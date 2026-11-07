SET statement_timeout = 0;
CREATE TABLE friend_relations (
    user_id uuid NOT NULL, friend_id uuid NOT NULL, PRIMARY KEY (user_id, friend_id)
);
