-- CreateTable
CREATE TABLE "farm" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "name" VARCHAR(150) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "farm_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "farm"
ADD CONSTRAINT "farm_single_installation_check"
CHECK ("id" = 1);