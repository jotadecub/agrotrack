-- CreateEnum
CREATE TYPE "animal_change_action" AS ENUM ('CREATED', 'UPDATED', 'DEACTIVATED');

-- CreateTable
CREATE TABLE "animal_change_log" (
    "id" UUID NOT NULL,
    "animal_id" UUID NOT NULL,
    "action" "animal_change_action" NOT NULL,
    "changed_by_id" UUID NOT NULL,
    "previous_data" JSONB,
    "new_data" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "animal_change_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "animal_change_log_animal_id_created_at_idx" ON "animal_change_log"("animal_id", "created_at");

-- CreateIndex
CREATE INDEX "animal_change_log_changed_by_id_idx" ON "animal_change_log"("changed_by_id");

-- AddForeignKey
ALTER TABLE "animal_change_log" ADD CONSTRAINT "animal_change_log_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_change_log" ADD CONSTRAINT "animal_change_log_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
