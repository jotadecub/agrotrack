-- CreateEnum
CREATE TYPE "animal_sex" AS ENUM ('FEMALE', 'MALE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "animal_status" AS ENUM ('ALIVE', 'DEAD', 'SOLD', 'SICK', 'TRANSFERRED');

-- CreateTable
CREATE TABLE "species" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "species_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "breed" (
    "id" SERIAL NOT NULL,
    "species_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "breed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animal" (
    "id" UUID NOT NULL,
    "farm_id" INTEGER NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150),
    "species_id" INTEGER NOT NULL,
    "breed_id" INTEGER,
    "sex" "animal_sex" NOT NULL DEFAULT 'UNKNOWN',
    "birth_date" DATE,
    "weight_kg" DECIMAL(10,2),
    "mother_id" UUID,
    "father_id" UUID,
    "status" "animal_status" NOT NULL DEFAULT 'ALIVE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "animal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "species_name_key" ON "species"("name");

-- CreateIndex
CREATE INDEX "breed_species_id_idx" ON "breed"("species_id");

-- CreateIndex
CREATE UNIQUE INDEX "breed_species_id_name_key" ON "breed"("species_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "animal_code_key" ON "animal"("code");

-- CreateIndex
CREATE INDEX "animal_farm_id_status_idx" ON "animal"("farm_id", "status");

-- CreateIndex
CREATE INDEX "animal_species_id_idx" ON "animal"("species_id");

-- CreateIndex
CREATE INDEX "animal_breed_id_idx" ON "animal"("breed_id");

-- CreateIndex
CREATE INDEX "animal_mother_id_idx" ON "animal"("mother_id");

-- CreateIndex
CREATE INDEX "animal_father_id_idx" ON "animal"("father_id");

-- AddForeignKey
ALTER TABLE "breed" ADD CONSTRAINT "breed_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal" ADD CONSTRAINT "animal_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal" ADD CONSTRAINT "animal_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal" ADD CONSTRAINT "animal_breed_id_fkey" FOREIGN KEY ("breed_id") REFERENCES "breed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal" ADD CONSTRAINT "animal_mother_id_fkey" FOREIGN KEY ("mother_id") REFERENCES "animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal" ADD CONSTRAINT "animal_father_id_fkey" FOREIGN KEY ("father_id") REFERENCES "animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal" ADD CONSTRAINT "animal_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal" ADD CONSTRAINT "animal_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
