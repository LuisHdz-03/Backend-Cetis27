ALTER TABLE "materias"
ADD COLUMN "espacioId" INTEGER;

CREATE INDEX "materias_espacioId_idx" ON "materias"("espacioId");

ALTER TABLE "materias"
ADD CONSTRAINT "materias_espacioId_fkey"
FOREIGN KEY ("espacioId") REFERENCES "espacios"("idEspacio")
ON DELETE SET NULL ON UPDATE CASCADE;