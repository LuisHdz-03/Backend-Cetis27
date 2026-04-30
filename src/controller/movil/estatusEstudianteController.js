// Controlador para que el padre/tutor consulte el estatus del estudiante
const prisma = require("../../config/prisma");

const consultarEstatusEstudiante = async (req, res) => {
  try {
    const { idEstudiante } = req.params;
    const estudiante = await prisma.estudiante.findUnique({
      where: { idEstudiante: Number(idEstudiante) },
      include: {
        usuario: {
          select: {
            nombre: true,
            apellidoPaterno: true,
            apellidoMaterno: true,
            email: true,
            telefono: true,
            direccion: true,
            curp: true,
            activo: true,
          },
        },
        grupo: {
          select: {
            nombre: true,
            grado: true,
            turno: true,
            especialidad: { select: { nombre: true } },
          },
        },
      },
    });
    if (!estudiante) {
      return res.status(404).json({ mensaje: "Estudiante no encontrado." });
    }
    res.json({
      ok: true,
      estudiante,
    });
  } catch (error) {
    console.error("Error al consultar estatus del estudiante:", error);
    res
      .status(500)
      .json({ error: "Error al consultar estatus del estudiante" });
  }
};

// Consulta resumen, asistencias y reportes del alumno
const consultarEstatusCompletoEstudiante = async (req, res) => {
  try {
    const { idEstudiante } = req.params;
    // Resumen
    const estudiante = await prisma.estudiante.findUnique({
      where: { idEstudiante: Number(idEstudiante) },
      include: {
        usuario: {
          select: {
            nombre: true,
            apellidoPaterno: true,
            apellidoMaterno: true,
            curp: true,
          },
        },
        grupo: {
          include: {
            especialidad: { select: { nombre: true } },
          },
        },
      },
    });
    if (!estudiante) {
      return res.status(404).json({ error: "Alumno no encontrado" });
    }
    // Asistencias
    const asistencias = await prisma.asistencia.findMany({
      where: { alumnoId: estudiante.idEstudiante },
      include: {
        clase: {
          include: {
            materias: { select: { nombre: true } },
          },
        },
      },
      orderBy: { fecha: "desc" },
    });
    // Entradas y salidas (accesos)
    const accesos = await prisma.accesos.findMany({
      where: { alumnoId: estudiante.idEstudiante },
      orderBy: { fechaHora: "desc" },
      select: {
        idAcceso: true,
        fechaHora: true,
        tipo: true,
      },
    });
    // Reportes
    const reportes = await prisma.reporte.findMany({
      where: { alumnoId: estudiante.idEstudiante },
      include: {
        docente: {
          include: {
            usuario: { select: { nombre: true, apellidoPaterno: true } },
          },
        },
      },
      orderBy: { fecha: "desc" },
    });
    // Formateo
    const resumen = {
      idEstudiante: estudiante.idEstudiante,
      matricula: estudiante.matricula,
      nombreCompleto:
        `${estudiante.usuario.nombre} ${estudiante.usuario.apellidoPaterno} ${estudiante.usuario.apellidoMaterno || ""}`.trim(),
      curp: estudiante.usuario.curp,
      grupo: estudiante.grupo,
    };
    const asistenciasLimpias = asistencias.map((a) => ({
      idAsistencia: a.idAsistencia,
      fecha: a.fecha,
      estatus: a.estatus,
      materia: a.clase?.materias?.nombre || "Sin materia",
    }));
    const accesosLimpios = accesos.map((ac) => ({
      idAcceso: ac.idAcceso,
      fechaHora: ac.fechaHora,
      tipo: ac.tipo,
    }));
    const reportesLimpios = reportes.map((r) => ({
      idReporte: r.idReporte,
      titulo: r.titulo,
      descripcion: r.descripcion,
      tipoIncidencia: r.tipoIncidencia,
      nivel: r.nivel,
      estatus: r.estatus,
      fecha: r.fecha,
      accionesTomadas: r.accionesTomadas,
      docente: r.docente
        ? `${r.docente.usuario.nombre} ${r.docente.usuario.apellidoPaterno}`
        : "Administración",
    }));
    res.json({
      ok: true,
      resumen,
      asistencias: asistenciasLimpias,
      accesos: accesosLimpios,
      reportes: reportesLimpios,
    });
  } catch (error) {
    console.error("Error al consultar estatus completo del estudiante:", error);
    res.status(500).json({ error: "Error al consultar estatus completo del estudiante" });
  }
};


module.exports = {
  consultarEstatusEstudiante,
  consultarEstatusCompletoEstudiante
};
