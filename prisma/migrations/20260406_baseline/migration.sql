-- CreateEnum
CREATE TYPE "Turno" AS ENUM ('MATUTINO', 'VESPERTINO', 'MIXTO');

-- CreateTable
CREATE TABLE "usuarios" (
    "idUsuario" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellidoPaterno" TEXT NOT NULL,
    "apellidoMaterno" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "telefono" TEXT,
    "direccion" TEXT,
    "fechaNacimiento" TIMESTAMP(3),
    "curp" TEXT NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("idUsuario")
);

-- CreateTable
CREATE TABLE "docentes" (
    "idDocente" SERIAL NOT NULL,
    "numeroEmpleado" TEXT,
    "usuarioId" INTEGER NOT NULL,
    "especialidadId" INTEGER,
    "fechaContratacion" TIMESTAMP(3),

    CONSTRAINT "docentes_pkey" PRIMARY KEY ("idDocente")
);

-- CreateTable
CREATE TABLE "estudiantes" (
    "idEstudiante" SERIAL NOT NULL,
    "matricula" TEXT NOT NULL,
    "semestre" INTEGER NOT NULL,
    "fotoUrl" TEXT,
    "fechaIngreso" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "datosVerificados" BOOLEAN NOT NULL DEFAULT false,
    "credencialFechaEmision" TIMESTAMP(3),
    "credencialFechaExpiracion" TIMESTAMP(3),
    "usuarioId" INTEGER NOT NULL,
    "grupoId" INTEGER,
    "tutorId" INTEGER,

    CONSTRAINT "estudiantes_pkey" PRIMARY KEY ("idEstudiante")
);

-- CreateTable
CREATE TABLE "periodos" (
    "idPeriodo" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "periodos_pkey" PRIMARY KEY ("idPeriodo")
);

-- CreateTable
CREATE TABLE "especialidades" (
    "idEspecialidad" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "especialidades_pkey" PRIMARY KEY ("idEspecialidad")
);

-- CreateTable
CREATE TABLE "tutores" (
    "idTutor" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellidoPaterno" TEXT NOT NULL,
    "apellidoMaterno" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "email" TEXT,
    "parentesco" TEXT NOT NULL,
    "direccion" TEXT,

    CONSTRAINT "tutores_pkey" PRIMARY KEY ("idTutor")
);

-- CreateTable
CREATE TABLE "grupos" (
    "idGrupo" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "grado" INTEGER NOT NULL,
    "turno" "Turno" NOT NULL,
    "aula" TEXT,
    "especialidadId" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "grupos_pkey" PRIMARY KEY ("idGrupo")
);

-- CreateTable
CREATE TABLE "materias" (
    "idMateria" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT,
    "horasSemana" INTEGER,
    "semestre" INTEGER,
    "especialidadId" INTEGER,
    "creditos" INTEGER,
    "horasPractica" INTEGER,
    "horasTeoria" INTEGER,

    CONSTRAINT "materias_pkey" PRIMARY KEY ("idMateria")
);

-- CreateTable
CREATE TABLE "clases" (
    "idClase" SERIAL NOT NULL,
    "grupoId" INTEGER NOT NULL,
    "materiaId" INTEGER NOT NULL,
    "docenteId" INTEGER NOT NULL,
    "horario" JSONB,
    "periodoId" INTEGER NOT NULL,

    CONSTRAINT "clases_pkey" PRIMARY KEY ("idClase")
);

-- CreateTable
CREATE TABLE "asistencias" (
    "idAsistencia" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estatus" TEXT NOT NULL,
    "claseId" INTEGER NOT NULL,
    "alumnoId" INTEGER NOT NULL,

    CONSTRAINT "asistencias_pkey" PRIMARY KEY ("idAsistencia")
);

-- CreateTable
CREATE TABLE "reportes" (
    "idReporte" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "tipoIncidencia" TEXT NOT NULL,
    "nivel" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estatus" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "accionesTomadas" TEXT,
    "alumnoId" INTEGER NOT NULL,
    "docenteId" INTEGER,
    "reportadoPor" TEXT,

    CONSTRAINT "reportes_pkey" PRIMARY KEY ("idReporte")
);

-- CreateTable
CREATE TABLE "accesos" (
    "idAcceso" SERIAL NOT NULL,
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" TEXT NOT NULL,
    "alumnoId" INTEGER NOT NULL,

    CONSTRAINT "accesos_pkey" PRIMARY KEY ("idAcceso")
);

-- CreateTable
CREATE TABLE "bitacoras" (
    "idBitacora" SERIAL NOT NULL,
    "accion" TEXT NOT NULL,
    "detalle" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" INTEGER NOT NULL,

    CONSTRAINT "bitacoras_pkey" PRIMARY KEY ("idBitacora")
);

-- CreateTable
CREATE TABLE "administrativos" (
    "idAdministrativo" SERIAL NOT NULL,
    "numeroEmpleado" TEXT,
    "cargo" TEXT NOT NULL,
    "area" TEXT,
    "usuarioId" INTEGER NOT NULL,

    CONSTRAINT "administrativos_pkey" PRIMARY KEY ("idAdministrativo")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_curp_key" ON "usuarios"("curp");

-- CreateIndex
CREATE UNIQUE INDEX "docentes_usuarioId_key" ON "docentes"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "estudiantes_matricula_key" ON "estudiantes"("matricula");

-- CreateIndex
CREATE UNIQUE INDEX "estudiantes_usuarioId_key" ON "estudiantes"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "administrativos_usuarioId_key" ON "administrativos"("usuarioId");

-- AddForeignKey
ALTER TABLE "docentes" ADD CONSTRAINT "docentes_especialidadId_fkey" FOREIGN KEY ("especialidadId") REFERENCES "especialidades"("idEspecialidad") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docentes" ADD CONSTRAINT "docentes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("idUsuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estudiantes" ADD CONSTRAINT "estudiantes_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "grupos"("idGrupo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estudiantes" ADD CONSTRAINT "estudiantes_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "tutores"("idTutor") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estudiantes" ADD CONSTRAINT "estudiantes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("idUsuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupos" ADD CONSTRAINT "grupos_especialidadId_fkey" FOREIGN KEY ("especialidadId") REFERENCES "especialidades"("idEspecialidad") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materias" ADD CONSTRAINT "materias_especialidadId_fkey" FOREIGN KEY ("especialidadId") REFERENCES "especialidades"("idEspecialidad") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clases" ADD CONSTRAINT "clases_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "docentes"("idDocente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clases" ADD CONSTRAINT "clases_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "grupos"("idGrupo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clases" ADD CONSTRAINT "clases_materiaId_fkey" FOREIGN KEY ("materiaId") REFERENCES "materias"("idMateria") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clases" ADD CONSTRAINT "clases_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "periodos"("idPeriodo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "estudiantes"("idEstudiante") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_claseId_fkey" FOREIGN KEY ("claseId") REFERENCES "clases"("idClase") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes" ADD CONSTRAINT "reportes_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "estudiantes"("idEstudiante") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes" ADD CONSTRAINT "reportes_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "docentes"("idDocente") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accesos" ADD CONSTRAINT "accesos_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "estudiantes"("idEstudiante") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitacoras" ADD CONSTRAINT "bitacoras_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("idUsuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "administrativos" ADD CONSTRAINT "administrativos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("idUsuario") ON DELETE RESTRICT ON UPDATE CASCADE;

