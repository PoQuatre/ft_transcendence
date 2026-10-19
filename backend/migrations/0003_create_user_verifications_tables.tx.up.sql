SET statement_timeout = 0;
ALTER TABLE "public"."users" ALTER COLUMN "verified" SET NOT NULL;
CREATE TABLE "user_verifications" ("user_id" uuid NOT NULL, "code" VARCHAR NOT NULL, "ends_at" TIMESTAMPTZ NOT NULL, PRIMARY KEY ("user_id"));
