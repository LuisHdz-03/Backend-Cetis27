/*
  Warnings:

  - A unique constraint covering the columns `[claseId,alumnoId,fecha]` on the table `asistencias` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "asistencias" ADD COLUMN     "tomadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "fecha" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "asistencias_claseId_alumnoId_fecha_key" ON "asistencias"("claseId", "alumnoId", "fecha");
