const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const crearReporte = async (req, res) => {
  try {
    const { titulo, descripcion, tipoIncidencia, nivel, alumnoId, docenteId } =
      req.body;

    if (!titulo || !descripcion || !alumnoId || !docenteId) {
      return res.status(400).json({ mensaje: "Faltan datos" });
    }

    const nuevoReporte = await prisma.reporte.create({
      data: {
        titulo,
        descripcion,
        tipoIncidencia: tipoIncidencia || "CONDUCTA",
        nivel: nivel || "LEVE",
        estatus: "PENDIENTE",
        alumnoId: parseInt(alumnoId),
        docenteId: parseInt(docenteId),
      },
    });

    res.status(201).json({
      mensaje: "Reporte generado correctamente",
      reporte: nuevoReporte,
    });
  } catch (error) {
    res.status(500).json({ error: "error al crear el reporte" });
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
    res.status(500).json({ error: "Error al obtener los reportes " });
  }
};

const atenderReporte = async (req, res) => {
  const { idReporte } = req.params;
  const { accionesTomadas, estatus } = req.body;

  try {
    const reporteActualizado = await prisma.reporte.update({
      where: { idReporte: parseInt(idReporte) },
      data: {
        estatus: estatus || "ATENDIDO",
        accionesTomadas: accionesTomadas || "Sin comentarios adicionales.",
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
