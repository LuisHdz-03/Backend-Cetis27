const prisma = require("../../config/prisma");

const validarAccesoEstudiante = (req, idEstudiante) => {
  return (
    req.usuario?.rol === "PADRE" && req.usuario?.idEstudiante === idEstudiante
  );
};

// ======================================
// RESUMEN DEL ESTUDIANTE
// ======================================

const consultarResumenEstudiante = async (req, res) => {
  try {
    const idEstudiante = Number(req.params.idEstudiante);

    if (!Number.isInteger(idEstudiante)) {
      return res.status(400).json({
        error: "ID inválido",
      });
    }

    if (!validarAccesoEstudiante(req, idEstudiante)) {
      return res.status(403).json({
        error: "No tienes permisos",
      });
    }

    const estudiante = await prisma.estudiante.findUnique({
      where: {
        idEstudiante,
      },

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
            especialidad: {
              select: {
                nombre: true,
              },
            },
          },
        },
      },
    });

    if (!estudiante) {
      return res.status(404).json({
        error: "Alumno no encontrado",
      });
    }

    const resumen = {
      idEstudiante: estudiante.idEstudiante,

      matricula: estudiante.matricula,

      nombreCompleto: `${estudiante.usuario.nombre}
      ${estudiante.usuario.apellidoPaterno}
      ${estudiante.usuario.apellidoMaterno || ""}`.trim(),

      curp: estudiante.usuario.curp,

      grupo: estudiante.grupo,
    };

    res.json({
      ok: true,
      resumen,
    });
  } catch (error) {
    res.status(500).json({
      error: "Error al consultar resumen",
    });
  }
};

// ======================================
// ACCESOS PAGINADOS
// ======================================

const consultarAccesosEstudiante = async (req, res) => {
  try {
    const idEstudiante = Number(req.params.idEstudiante);

    if (!validarAccesoEstudiante(req, idEstudiante)) {
      return res.status(403).json({
        error: "No tienes permisos",
      });
    }

    const pagina = Number(req.query.pagina) || 1;

    const limite = Number(req.query.limite) || 10;

    const skip = (pagina - 1) * limite;

    const [accesos, total] = await Promise.all([
      prisma.accesos.findMany({
        where: {
          alumnoId: idEstudiante,
        },

        orderBy: {
          fechaHora: "desc",
        },

        skip,

        take: limite,

        select: {
          idAcceso: true,
          fechaHora: true,
          tipo: true,
        },
      }),

      prisma.accesos.count({
        where: {
          alumnoId: idEstudiante,
        },
      }),
    ]);

    res.json({
      ok: true,

      accesos,

      paginacion: {
        paginaActual: pagina,

        totalRegistros: total,

        totalPaginas: Math.ceil(total / limite),

        limite,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Error al consultar accesos",
    });
  }
};

// ======================================
// ASISTENCIAS
// ======================================

const consultarAsistenciasEstudiante = async (req, res) => {
  try {
    const idEstudiante = Number(req.params.idEstudiante);

    if (!validarAccesoEstudiante(req, idEstudiante)) {
      return res.status(403).json({
        error: "No tienes permisos",
      });
    }

    const asistencias = await prisma.asistencia.findMany({
      where: {
        alumnoId: idEstudiante,
      },

      include: {
        clase: {
          include: {
            materias: {
              select: {
                nombre: true,
              },
            },
          },
        },
      },

      orderBy: {
        fecha: "desc",
      },
    });

    const datos = asistencias.map((a) => ({
      idAsistencia: a.idAsistencia,

      fecha: a.fecha,

      estatus: a.estatus,

      materia: a.clase?.materias?.nombre || "Sin materia",
    }));

    res.json({
      ok: true,

      asistencias: datos,
    });
  } catch (error) {
    res.status(500).json({
      error: "Error al consultar asistencias",
    });
  }
};

// ======================================
// REPORTES
// ======================================

const consultarReportesEstudiante = async (req, res) => {
  try {
    const idEstudiante = Number(req.params.idEstudiante);

    if (!validarAccesoEstudiante(req, idEstudiante)) {
      return res.status(403).json({
        error: "No tienes permisos",
      });
    }

    const reportes = await prisma.reporte.findMany({
      where: {
        alumnoId: idEstudiante,
      },

      include: {
        docente: {
          include: {
            usuario: {
              select: {
                nombre: true,
                apellidoPaterno: true,
              },
            },
          },
        },
      },

      orderBy: {
        fecha: "desc",
      },
    });

    const datos = reportes.map((r) => ({
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

      reportes: datos,
    });
  } catch (error) {
    res.status(500).json({
      error: "Error al consultar reportes",
    });
  }
};

module.exports = {
  consultarResumenEstudiante,
  consultarAccesosEstudiante,
  consultarAsistenciasEstudiante,
  consultarReportesEstudiante,
};
