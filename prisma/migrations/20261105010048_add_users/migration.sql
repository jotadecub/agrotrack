-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMIN', 'SUPERVISOR', 'READER');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "app_user" (
    "id" UUID NOT NULL,
    "identification" VARCHAR(50) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(30),
    "address" VARCHAR(250),
    "password_hash" TEXT NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'READER',
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_user_identification_key" ON "app_user"("identification");
