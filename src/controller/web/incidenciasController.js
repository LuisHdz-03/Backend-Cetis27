const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

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

    console.log("=== DATOS RECIBIDOS EN EL BACKEND ===", req.body);

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

    // Si hay un docente, también lo conectamos de forma segura
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
                especialidad: true, // Necesario para mostrar la especialidad en la tabla
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
  const { idReporte } = req.params; // Fíjate que tu Front manda el PUT a /incidencias/:id, asegúrate que las rutas coincidan
  const { accionesTomadas, estado } = req.body; // El front te mandaba 'estado' en lugar de 'estatus'

  try {
    const reporteActualizado = await prisma.reporte.update({
      where: { idReporte: parseInt(idReporte) },
      data: {
        estatus: estado || "RESUELTO", // Usamos el estado que manda el front o "RESUELTO" por defecto
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
