const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const registrarAsistencia = async (req, res) => {
  try {
    const { claseId, fecha, listaAlumnos, metodo } = req.body;

    if (!claseId || !listaAlumnos || !listaAlumnos.length === 0) {
      return res.status(400).json({ mensaje: "Faltan datos " });
    }

    const fechaRegistro = fecha ? new Date(fecha) : new Date();

    const inicioDia = new Date(fechaRegistro);
    inicioDia.setHours(0, 0, 0, 0);

    const finDia = new Date(fechaRegistro);
    finDia.setHours(23, 59, 59, 999);

    const asistenciaExistente = await prisma.asistencia.findFirst({
      where: {
        claseId: parseInt(claseId),
        fecha: {
          gte: inicioDia,
          lte: finDia,
        },
      },
    });

    if (asistenciaExistente) {
      return res.status(400).json({
        mensaje: "Ya se tomo la asistencia del dia de hoy",
        bloqueado: true,
      });
    }

    const datosPaInsertar = listaAlumnos.map((alumno) => ({
      claseId: parseInt(claseId),
      alumnoId: parseInt(alumno.alumnoId),
      estatus: alumno.estatus.toUpperCase(),
      fecha: fechaRegistro,
    }));

    const resultado = await prisma.asistencia.createMany({
      data: datosPaInsertar,
      skipDuplicates: true,
    });

    res.status(201).json({
      mensaje: "Asistencias tomdas",
      totalRegistros: resultado.count,
      fecha: fechaRegistro.toISOString().split("T")[0],
    });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al tomar las asistencias " });
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
      return res.estatus(404).json({ error: "Registro no encontrado" });
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

module.exports = { registrarAsistencia, getAsisPorFecha, justificarFalta };
