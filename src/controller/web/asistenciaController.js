const prisma = require("../../config/prisma");

const registrarAsistencia = async (req, res) => {
  try {
    const { claseId, fecha, listaAlumnos, metodo } = req.body;

    if (!claseId || !listaAlumnos || listaAlumnos.length === 0) {
      return res.status(400).json({ mensaje: "Faltan datos válidos" });
    }

    let fechaParaGuardar;

    if (fecha) {
      // EDICIÓN: Si el frontend manda una fecha, significa que el profesor está editando.
      fechaParaGuardar = new Date(fecha);

      // Borramos los registros exactos de esa fecha/hora para reemplazarlos
      await prisma.asistencia.deleteMany({
        where: {
          claseId: parseInt(claseId),
          fecha: fechaParaGuardar,
        },
      });
    } else {
      // NUEVA: Si el frontend NO manda fecha, es un pase de lista 100% nuevo
      fechaParaGuardar = new Date();
    }

    const datosPaInsertar = listaAlumnos.map((alumno) => ({
      claseId: parseInt(claseId),
      alumnoId: parseInt(alumno.alumnoId),
      estatus: alumno.estatus.toUpperCase(),
      fecha: fechaParaGuardar,
    }));

    const resultado = await prisma.asistencia.createMany({
      data: datosPaInsertar,
      skipDuplicates: true,
    });

    res.status(201).json({
      mensaje: fecha
        ? "Asistencia actualizada correctamente"
        : "Asistencia registrada correctamente",
      totalRegistros: resultado.count,
      fecha: fechaParaGuardar.toISOString(),
    });
  } catch (error) {
    console.error("Error al tomar las asistencias:", error);
    res.status(500).json({ mensaje: "Error interno al tomar las asistencias" });
  }
};

const getAsisPorFecha = async (req, res) => {
  try {
    const { claseId, fecha } = req.query;

    if (!claseId || !fecha) {
      return res.status(400).json({ error: "Se requiere claseId y fecha." });
    }

    const fechaBusqueda = new Date(fecha);
    const inicio = new Date(fechaBusqueda.setHours(0, 0, 0, 0));
    const fin = new Date(fechaBusqueda.setHours(23, 59, 59, 999));

    const asistencias = await prisma.asistencia.findMany({
      where: {
        claseId: parseInt(claseId),
        fecha: {
          gte: inicio,
          lte: fin,
        },
      },
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
      },
      orderBy: {
        alumno: { usuario: { apellidoPaterno: "asc" } },
      },
    });
    res.json(asistencias);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener asistencias " });
  }
};

const justificarFalta = async (req, res) => {
  const { idAsistencia } = req.params;
  try {
    const asistencia = await prisma.asistencia.findUnique({
      where: { idAsistencia: parseInt(idAsistencia) },
    });

    if (!asistencia) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    const fechaRegistro = new Date(asistencia.fecha);
    const ahora = new Date();

    const esHoy =
      fechaRegistro.getDate() === ahora.getDate() &&
      fechaRegistro.getMonth() === ahora.getMonth() &&
      fechaRegistro.getFullYear() === ahora.getFullYear();

    if (!esHoy) {
      return res.status(403).json({
        error: "El tiempo expiro. Solo se puede justificar el mismo dia",
      });
    }

    const actualizado = await prisma.asistencia.update({
      where: { idAsistencia: parseInt(idAsistencia) },
      data: { estatus: "JUSTIFICADA" },
    });

    res.json({ mensaje: "Justificacion exitosa", registro: actualizado });
  } catch (error) {
    res.status(500).json({ error: "error interno al justificar" });
  }
};

const getHistorialAsistencias = async (req, res) => {
  try {
    const { claseId, alumnoId, fechaInicio, fechaFin } = req.query;

    let whereClause = {};

    if (claseId) {
      whereClause.claseId = parseInt(claseId);
    }

    if (alumnoId) {
      whereClause.alumnoId = parseInt(alumnoId);
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

    const historial = await prisma.asistencia.findMany({
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
        clase: {
          include: {
            materias: true,
          },
        },
      },
      orderBy: [
        { fecha: "desc" },
        { alumno: { usuario: { apellidoPaterno: "asc" } } },
      ],
    });

    res.json(historial);
  } catch (error) {
    console.error("Error al obtener el historial de asistencias:", error);
    res
      .status(500)
      .json({ error: "Error al obtener el historial de asistencias." });
  }
};

module.exports = {
  registrarAsistencia,
  getAsisPorFecha,
  justificarFalta,
  getHistorialAsistencias,
};
