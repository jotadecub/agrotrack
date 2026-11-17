-- CreateTable
CREATE TABLE "diseases" (
    "id" TEXT NOT NULL,
    "farmId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID NOT NULL,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diseases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "diseases_farmId_isActive_idx" ON "diseases"("farmId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "diseases_farmId_name_key" ON "diseases"("farmId", "name");

-- AddForeignKey
ALTER TABLE "diseases" ADD CONSTRAINT "diseases_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diseases" ADD CONSTRAINT "diseases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diseases" ADD CONSTRAINT "diseases_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
