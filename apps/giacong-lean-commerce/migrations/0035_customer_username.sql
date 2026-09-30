-- Add usernames for customer email/password accounts. Google-only customers can keep NULL.
ALTER TABLE "user" ADD COLUMN "username" TEXT;

CREATE UNIQUE INDEX "better_auth_user_username_unique_idx"
  ON "user" ("username");
