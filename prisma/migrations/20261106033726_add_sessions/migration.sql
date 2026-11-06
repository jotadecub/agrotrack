-- CreateTable
CREATE TABLE "auth_session" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "auth_session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auth_session_user_id_revoked_at_idx" ON "auth_session"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "auth_session_expires_at_idx" ON "auth_session"("expires_at");

-- AddForeignKey
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "auth_session"
ADD CONSTRAINT "auth_session_expiration_check"
CHECK ("expires_at" > "created_at");

ALTER TABLE "auth_session"
ADD CONSTRAINT "auth_session_revocation_check"
CHECK (
  "revoked_at" IS NULL
  OR "revoked_at" >= "created_at"
);