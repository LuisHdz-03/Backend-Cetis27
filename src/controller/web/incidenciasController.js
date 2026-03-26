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

    if (!titulo || !descripcion || !estudianteId) {
      return res.status(400).json({
        mensaje:
          "Faltan datos obligatorios (titulo, descripcion o estudianteId)",
      });
    }

    const dataReporte = {
      titulo: titulo,
      descripcion: descripcion,
      tipoIncidencia: tipo || "DISCIPLINARIO",
      nivel: gravedad || "MEDIA",
      accionesTomadas: acciones || "Pendiente de revisión",
      estatus: "PENDIENTE",
      reportadoPor: reportadoPor || "Administración",
      alumnoId: idEstudianteNumero,
    };

    if (docenteId) {
      dataReporte.docente = {
        connect: { idDocente: parseInt(docenteId) },
      };
    }

    const nuevoReporte = await prisma.reporte.create({
      data: dataReporte,
    });

    res.status(201).json({
      mensaje: "Reporte generado y guardado correctamente",
      reporte: nuevoReporte,
    });
  } catch (error) {
    console.error("Error al crear el reporte en la BD:", error);
    res.status(500).json({ error: "Error interno al crear el reporte" });
  }
};

const getReporte = async (req, res) => {
  try {
    const { estatus } = req.query;

    const whereClause = {};
    if (estatus) whereClause.estatus = estatus;

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
};
