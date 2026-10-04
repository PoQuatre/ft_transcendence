SET statement_timeout = 0;
CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuidv7(), "username" VARCHAR NOT NULL, "email" VARCHAR NOT NULL, "password_hash" VARCHAR NOT NULL, "created_at" TIMESTAMPTZ NOT NULL DEFAULT current_timestamp, "updated_at" TIMESTAMPTZ NOT NULL DEFAULT current_timestamp, PRIMARY KEY ("id"), UNIQUE ("username"), UNIQUE ("email"));
