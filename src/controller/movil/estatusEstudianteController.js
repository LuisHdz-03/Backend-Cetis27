// Controlador para que el padre/tutor consulte el estatus del estudiante
const prisma = require("../../config/prisma");

const validarAccesoEstudiante = (req, idEstudiante) => {
  return (
    req.usuario?.rol === "PADRE" && req.usuario?.idEstudiante === idEstudiante
  );
};

const consultarEstatusEstudiante = async (req, res) => {
  try {
    const { idEstudiante } = req.params;
    const idEstudianteNum = Number(idEstudiante);

    if (!Number.isInteger(idEstudianteNum)) {
      return res.status(400).json({ mensaje: "ID de estudiante inválido." });
    }

    if (!validarAccesoEstudiante(req, idEstudianteNum)) {
      return res.status(403).json({
        error:
          "No tienes permisos para consultar información de otro estudiante.",
      });
    }

    const estudiante = await prisma.estudiante.findUnique({
      where: { idEstudiante: idEstudianteNum },
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
    res
      .status(500)
      .json({ error: "Error al consultar estatus del estudiante" });
  }
};

// Consulta resumen, asistencias y reportes del alumno
const consultarEstatusCompletoEstudiante = async (req, res) => {
  try {
    const { idEstudiante } = req.params;
    const idEstudianteNum = Number(idEstudiante);

    if (!Number.isInteger(idEstudianteNum)) {
      return res.status(400).json({ error: "ID de estudiante inválido" });
    }

    if (!validarAccesoEstudiante(req, idEstudianteNum)) {
      return res.status(403).json({
        error:
          "No tienes permisos para consultar información de otro estudiante.",
      });
    }

    // Resumen
    const estudiante = await prisma.estudiante.findUnique({
      where: { idEstudiante: idEstudianteNum },
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
      reportadoPor: r.reportadoPor || null,
    }));
    res.json({
      ok: true,
      resumen,
      asistencias: asistenciasLimpias,
      accesos: accesosLimpios,
      reportes: reportesLimpios,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error al consultar estatus completo del estudiante" });
  }
};

module.exports = {
  consultarEstatusEstudiante,
  consultarEstatusCompletoEstudiante,
};
