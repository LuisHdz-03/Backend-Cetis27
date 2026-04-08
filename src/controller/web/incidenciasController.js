const prisma = require("../../config/prisma");

const crearReporte = async (req, res) => {
  try {
    const {
      titulo,
      descripcion,
      tipo,
      gravedad,
      acciones,
      estudianteId,
      docenteId,
      reportadoPor,
    } = req.body;

    const idEstudianteNumero = parseInt(estudianteId, 10);

    if (
      !titulo ||
      !descripcion ||
      !idEstudianteNumero ||
      isNaN(idEstudianteNumero)
    ) {
      return res.status(400).json({
        mensaje:
          "Faltan datos obligatorios (titulo, descripcion o estudianteId)",
      });
    }

    const alumnoExiste = await prisma.estudiante.findUnique({
      where: { idEstudiante: idEstudianteNumero },
      select: { idEstudiante: true },
    });

    if (!alumnoExiste) {
      return res.status(400).json({
        mensaje: `El estudiante con id ${idEstudianteNumero} no existe`,
      });
    }

    const dataReporte = {
      titulo,
      descripcion,
      tipoIncidencia: tipo || "DISCIPLINARIO",
      nivel: gravedad || "MEDIA",
      accionesTomadas: acciones || "Pendiente de revisión",
      estatus: "PENDIENTE",
      reportadoPor: reportadoPor || "Administración",
      alumnoId: idEstudianteNumero,
    };

    if (docenteId !== undefined && docenteId !== null && docenteId !== "") {
      const idDocenteNumero = parseInt(docenteId, 10);
      if (isNaN(idDocenteNumero)) {
        return res.status(400).json({ mensaje: "docenteId inválido" });
      }

      dataReporte.docente = {
        connect: { idDocente: idDocenteNumero },
      };
    }

    const nuevoReporte = await prisma.reporte.create({
      data: dataReporte,
    });

    return res.status(201).json({
      mensaje: "Reporte generado y guardado correctamente",
      reporte: nuevoReporte,
    });
  } catch (error) {
    console.error("Error al crear el reporte en la BD:", error);
    return res.status(500).json({
      error: "Error interno al crear el reporte",
    });
  }
};

const getReporte = async (req, res) => {
  try {
    const {
      estatus,
      alumnoId,
      docenteId,
      tipo,
      nivel,
      fechaInicio,
      fechaFin,
      busqueda,
      reporteId,
    } = req.query;

    const whereClause = {};

    if (reporteId) {
      const parsedReporteId = parseInt(reporteId, 10);
      if (isNaN(parsedReporteId)) {
        return res.status(400).json({ error: "reporteId inválido" });
      }
      whereClause.idReporte = parsedReporteId;
    }

    if (estatus) whereClause.estatus = String(estatus).toUpperCase();
    if (tipo) whereClause.tipoIncidencia = String(tipo).toUpperCase();
    if (nivel) whereClause.nivel = String(nivel).toUpperCase();

    if (alumnoId) {
      const parsedAlumnoId = parseInt(alumnoId, 10);
      if (isNaN(parsedAlumnoId)) {
        return res.status(400).json({ error: "alumnoId inválido" });
      }
      whereClause.alumnoId = parsedAlumnoId;
    }

    if (docenteId) {
      const parsedDocenteId = parseInt(docenteId, 10);
      if (isNaN(parsedDocenteId)) {
        return res.status(400).json({ error: "docenteId inválido" });
      }
      whereClause.docenteId = parsedDocenteId;
    }

    if (fechaInicio || fechaFin) {
      whereClause.fecha = {};
      if (fechaInicio) {
        const inicio = new Date(fechaInicio);
        inicio.setHours(0, 0, 0, 0);
        whereClause.fecha.gte = inicio;
      }
      if (fechaFin) {
        const fin = new Date(fechaFin);
        fin.setHours(23, 59, 59, 999);
        whereClause.fecha.lte = fin;
      }
    }

    if (busqueda) {
      const valorBusqueda = String(busqueda).trim();
      whereClause.OR = [
        { titulo: { contains: valorBusqueda, mode: "insensitive" } },
        { descripcion: { contains: valorBusqueda, mode: "insensitive" } },
        {
          alumno: {
            matricula: { contains: valorBusqueda, mode: "insensitive" },
          },
        },
        {
          alumno: {
            usuario: {
              curp: { contains: valorBusqueda, mode: "insensitive" },
            },
          },
        },
        {
          alumno: {
            usuario: {
              nombre: { contains: valorBusqueda, mode: "insensitive" },
            },
          },
        },
        {
          alumno: {
            usuario: {
              apellidoPaterno: {
                contains: valorBusqueda,
                mode: "insensitive",
              },
            },
          },
        },
      ];
    }

    const reportes = await prisma.reporte.findMany({
      where: whereClause,
      include: {
        alumno: {
          include: {
            usuario: {
              select: {
                nombre: true,
                apellidoPaterno: true,
                apellidoMaterno: true,
              },
            },
            grupo: {
              include: {
                especialidad: true,
              },
            },
            tutor: {
              select: {
                nombre: true,
                apellidoPaterno: true,
                apellidoMaterno: true,
                telefono: true,
                parentesco: true,
                email: true,
                direccion: true,
              },
            },
          },
        },
        docente: {
          include: {
            usuario: { select: { nombre: true, apellidoPaterno: true } },
          },
        },
      },
      orderBy: { fecha: "desc" },
    });

    res.json(reportes);
  } catch (error) {
    console.error("Error en getReporte:", error);
    res.status(500).json({ error: "Error al obtener los reportes" });
  }
};

const getDocentesParaReporte = async (req, res) => {
  try {
    const docentes = await prisma.docente.findMany({
      where: {
        usuario: {
          activo: true,
        },
      },
      include: {
        usuario: {
          select: {
            nombre: true,
            apellidoPaterno: true,
            apellidoMaterno: true,
          },
        },
      },
      orderBy: {
        usuario: {
          apellidoPaterno: "asc",
        },
      },
    });

    const lista = docentes.map((d) => ({
      idDocente: d.idDocente,
      numeroEmpleado: d.numeroEmpleado,
      nombreCompleto:
        `${d.usuario.nombre} ${d.usuario.apellidoPaterno} ${d.usuario.apellidoMaterno || ""}`.trim(),
    }));

    return res.json(lista);
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "Error al obtener lista de docentes" });
  }
};

const atenderReporte = async (req, res) => {
  const { reporteId } = req.params;
  const { accionesTomadas, estado } = req.body;

  try {
    const reporteActualizado = await prisma.reporte.update({
      where: { idReporte: parseInt(reporteId) },
      data: {
        estatus: estado || "RESUELTO",
        ...(accionesTomadas && { accionesTomadas: accionesTomadas }),
      },
    });

    res.json({
      mensaje: "El reporte ha sido actualizado.",
      reporte: reporteActualizado,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "No se pudo actualizar el reporte." });
  }
};

const getHistorialAlumno = async (req, res) => {
  const { alumnoId } = req.params;
  try {
    const historial = await prisma.reporte.findMany({
      where: { alumnoId: parseInt(alumnoId) },
      orderBy: { fecha: "desc" },
      include: {
        docente: {
          include: {
            usuario: { select: { nombre: true, apellidoPaterno: true } },
          },
        },
      },
    });
    res.json(historial);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener historial." });
  }
};

module.exports = {
  crearReporte,
  getReporte,
  atenderReporte,
  getHistorialAlumno,
  getDocentesParaReporte,
};
