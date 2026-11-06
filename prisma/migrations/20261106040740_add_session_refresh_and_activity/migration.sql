/*
  Warnings:

  - A unique constraint covering the columns `[refresh_token_hash]` on the table `auth_session` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `refresh_token_hash` to the `auth_session` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "auth_session" ADD COLUMN     "last_activity_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "refresh_token_hash" CHAR(64) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "auth_session_refresh_token_hash_key" ON "auth_session"("refresh_token_hash");

ALTER TABLE "auth_session"
ADD CONSTRAINT "auth_session_activity_check"
CHECK (
  "last_activity_at" >= "created_at"
  AND "last_activity_at" <= "expires_at"
);