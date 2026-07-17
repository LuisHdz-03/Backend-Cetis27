-- CreateIndex
CREATE INDEX "accesos_alumnoId_idx" ON "accesos"("alumnoId");

-- CreateIndex
CREATE INDEX "accesos_fechaHora_idx" ON "accesos"("fechaHora");

-- CreateIndex
CREATE INDEX "asistencias_claseId_idx" ON "asistencias"("claseId");

-- CreateIndex
CREATE INDEX "asistencias_alumnoId_idx" ON "asistencias"("alumnoId");

-- CreateIndex
CREATE INDEX "asistencias_fecha_idx" ON "asistencias"("fecha");

-- CreateIndex
CREATE INDEX "bitacoras_usuarioId_idx" ON "bitacoras"("usuarioId");

-- CreateIndex
CREATE INDEX "bitacoras_fecha_idx" ON "bitacoras"("fecha");

-- CreateIndex
CREATE INDEX "clases_grupoId_idx" ON "clases"("grupoId");

-- CreateIndex
CREATE INDEX "clases_docenteId_idx" ON "clases"("docenteId");

-- CreateIndex
CREATE INDEX "clases_periodoId_idx" ON "clases"("periodoId");

-- CreateIndex
CREATE INDEX "estudiantes_grupoId_idx" ON "estudiantes"("grupoId");

-- CreateIndex
CREATE INDEX "estudiantes_semestre_idx" ON "estudiantes"("semestre");

-- CreateIndex
CREATE INDEX "estudiantes_tutorId_idx" ON "estudiantes"("tutorId");

-- CreateIndex
CREATE INDEX "grupos_especialidadId_idx" ON "grupos"("especialidadId");

-- CreateIndex
CREATE INDEX "grupos_docenteTutorId_idx" ON "grupos"("docenteTutorId");

-- CreateIndex
CREATE INDEX "reportes_alumnoId_idx" ON "reportes"("alumnoId");

-- CreateIndex
CREATE INDEX "reportes_estatus_idx" ON "reportes"("estatus");
