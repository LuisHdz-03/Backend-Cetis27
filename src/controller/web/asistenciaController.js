const prisma = require("../../config/prisma");

const registrarAsistencia = async (req, res) => {
  try {
    const { claseId, fecha, listaAlumnos, metodo } = req.body;

    if (!claseId || !listaAlumnos || listaAlumnos.length === 0) {
      return res.status(400).json({ mensaje: "Faltan datos válidos" });
    }

    // Usamos la fecha exacta con hora que envía el frontend (o el momento actual)
    const fechaRegistroExacta = fecha ? new Date(fecha) : new Date();

    // En lugar de buscar en todo el día, buscamos asistencias MUY recientes (ej. en los últimos 30 minutos)
    // para considerarlo una "modificación" de la misma lista, y no una nueva clase.
    const TIEMPO_MODIFICACION_MINUTOS = 30; // Ajusta este tiempo según tus necesidades
    const tiempoLimiteAtras = new Date(
      fechaRegistroExacta.getTime() - TIEMPO_MODIFICACION_MINUTOS * 60000,
    );

    // Buscamos si hay una lista de asistencia que se haya tomado hace poco
    const asistenciaReciente = await prisma.asistencia.findFirst({
      where: {
        claseId: parseInt(claseId),
        fecha: {
          gte: tiempoLimiteAtras,
          lte: fechaRegistroExacta, // Que no sea en el futuro
        },
      },
      orderBy: { fecha: "desc" }, // Agarramos la más reciente
    });

    let fechaParaGuardar = fechaRegistroExacta;

    // Si encontramos una lista reciente, asumimos que el profesor está "modificando/corrigiendo" la lista actual
    if (asistenciaReciente) {
      // BORRAMOS la lista anterior reciente (dentro del tiempo de gracia)
      await prisma.asistencia.deleteMany({
        where: {
          claseId: parseInt(claseId),
          // Borramos usando la fecha exacta de ese lote para no borrar otras listas del mismo día
          fecha: asistenciaReciente.fecha,
        },
      });

      // Mantenemos la fecha original del primer pase de lista para ese bloque
      fechaParaGuardar = asistenciaReciente.fecha;
    }

    // Preparamos los datos para insertar (ya sea una nueva lista a las 9 AM, o la corrección de la lista de las 7 AM)
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
      mensaje: asistenciaReciente
        ? "Asistencia actualizada correctamente"
        : "Asistencia registrada correctamente",
      totalRegistros: resultado.count,
      fecha: fechaParaGuardar.toISOString(), // Devolvemos el ISO completo con horas
    });
  } catch (error) {
    console.error("Error al tomar las asistencias:", error);
    res.status(500).json({ mensaje: "Error interno al tomar las asistencias" });
  }
};
