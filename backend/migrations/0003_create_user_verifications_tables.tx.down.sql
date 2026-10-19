SET statement_timeout = 0;
DROP TABLE "public"."user_verifications";
ALTER TABLE "public"."users" ALTER COLUMN "verified" DROP NOT NULL;
