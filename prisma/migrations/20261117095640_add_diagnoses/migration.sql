/*
  Warnings:

  - The primary key for the `diagnoses` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `animal_id` on the `diagnoses` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `diagnoses` table. All the data in the column will be lost.
  - You are about to drop the column `created_by_id` on the `diagnoses` table. All the data in the column will be lost.
  - You are about to drop the column `diagnosed_at` on the `diagnoses` table. All the data in the column will be lost.
  - You are about to drop the column `disease_id` on the `diagnoses` table. All the data in the column will be lost.
  - You are about to drop the column `farm_id` on the `diagnoses` table. All the data in the column will be lost.
  - You are about to drop the column `is_active` on the `diagnoses` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `diagnoses` table. All the data in the column will be lost.
  - You are about to drop the column `updated_by_id` on the `diagnoses` table. All the data in the column will be lost.
  - Added the required column `animalId` to the `diagnoses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdById` to the `diagnoses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `diagnosedAt` to the `diagnoses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `diseaseId` to the `diagnoses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `farmId` to the `diagnoses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `diagnoses` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "diagnoses" DROP CONSTRAINT "diagnoses_animal_id_fkey";

-- DropForeignKey
ALTER TABLE "diagnoses" DROP CONSTRAINT "diagnoses_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "diagnoses" DROP CONSTRAINT "diagnoses_disease_id_fkey";

-- DropForeignKey
ALTER TABLE "diagnoses" DROP CONSTRAINT "diagnoses_farm_id_fkey";

-- DropForeignKey
ALTER TABLE "diagnoses" DROP CONSTRAINT "diagnoses_updated_by_id_fkey";

-- DropIndex
DROP INDEX "diagnoses_animal_id_diagnosed_at_idx";

-- DropIndex
DROP INDEX "diagnoses_disease_id_idx";

-- DropIndex
DROP INDEX "diagnoses_farm_id_is_active_idx";

-- AlterTable
ALTER TABLE "diagnoses" DROP CONSTRAINT "diagnoses_pkey",
DROP COLUMN "animal_id",
DROP COLUMN "created_at",
DROP COLUMN "created_by_id",
DROP COLUMN "diagnosed_at",
DROP COLUMN "disease_id",
DROP COLUMN "farm_id",
DROP COLUMN "is_active",
DROP COLUMN "updated_at",
DROP COLUMN "updated_by_id",
ADD COLUMN     "animalId" UUID NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdById" UUID NOT NULL,
ADD COLUMN     "diagnosedAt" DATE NOT NULL,
ADD COLUMN     "diseaseId" TEXT NOT NULL,
ADD COLUMN     "farmId" INTEGER NOT NULL,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedById" UUID,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "diagnoses_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "diagnoses_farmId_isActive_idx" ON "diagnoses"("farmId", "isActive");

-- CreateIndex
CREATE INDEX "diagnoses_animalId_diagnosedAt_idx" ON "diagnoses"("animalId", "diagnosedAt");

-- CreateIndex
CREATE INDEX "diagnoses_diseaseId_idx" ON "diagnoses"("diseaseId");

-- AddForeignKey
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_diseaseId_fkey" FOREIGN KEY ("diseaseId") REFERENCES "diseases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
