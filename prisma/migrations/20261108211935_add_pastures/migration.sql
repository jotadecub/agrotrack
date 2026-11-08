-- AlterTable
ALTER TABLE "animal" ADD COLUMN     "current_pasture_id" UUID;

-- CreateTable
CREATE TABLE "pasture" (
    "id" UUID NOT NULL,
    "farm_id" INTEGER NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" VARCHAR(500),
    "area_hectares" DECIMAL(12,4),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pasture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pasture_farm_id_is_active_idx" ON "pasture"("farm_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "pasture_farm_id_name_key" ON "pasture"("farm_id", "name");

-- AddForeignKey
ALTER TABLE "animal" ADD CONSTRAINT "animal_current_pasture_id_fkey" FOREIGN KEY ("current_pasture_id") REFERENCES "pasture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pasture" ADD CONSTRAINT "pasture_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pasture" ADD CONSTRAINT "pasture_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pasture" ADD CONSTRAINT "pasture_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
