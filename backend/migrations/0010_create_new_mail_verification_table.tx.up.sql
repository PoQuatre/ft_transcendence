SET statement_timeout = 0;CREATE TABLE "new_mail_verifications" ("user_id" uuid NOT NULL, "code" VARCHAR NOT NULL, "email" VARCHAR NOT NULL, "ends_at" TIMESTAMPTZ NOT NULL, PRIMARY KEY ("user_id"));
