const prisma = require("../../config/prisma");

const crearPeriodo = async (req, res) => {
  try {
    const { nombre, codigo, fechaInicio, fechaFin, activo } = req.body;
    const seraActivo = activo !== undefined ? activo : true;

    if (seraActivo) {
      await prisma.periodo.updateMany({
        data: { activo: false },
      });
    }
    const nuevoPeriodo = await prisma.periodo.create({
      data: {
        nombre,
        codigo: codigo || nombre.substring(0, 4).toUpperCase(),
        fechaInicio: new Date(fechaInicio),
        fechaFin: new Date(fechaFin),
        activo: seraActivo,
      },
    });

    res.status(201).json(nuevoPeriodo);
  } catch (error) {
    console.error("Error al crear periodo:", error);
    res.status(500).json({ error: "Error al crear periodo." });
  }
};

const getPeriodos = async (req, res) => {
  try {
    const { activos } = req.query;

    let whereClause = {};
    if (activos === "true") {
      whereClause.activo = true;
    }

    const periodos = await prisma.periodo.findMany({
      where: whereClause,
      orderBy: { fechaInicio: "desc" },
    });

    res.json(periodos);
  } catch (error) {
    console.error("Error al obtener periodos:", error);
    res.status(500).json({ error: "Error al obtener periodos." });
  }
};

const setPeriodoActual = async (req, res) => {
  const { idPeriodo } = req.params;

  try {
    await prisma.$transaction([
      prisma.periodo.updateMany({
        data: { activo: false },
      }),
      prisma.periodo.update({
        where: { idPeriodo: parseInt(idPeriodo) },
        data: { activo: true },
      }),
    ]);

    res.json({ mensaje: `Periodo ${idPeriodo} establecido como ACTUAL.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al cambiar de periodo." });
  }
};

const cerrarPeriodoYPromover = async (req, res) => {
  const { id } = req.params;
  const idPeriodo = parseInt(id);

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Desactivar periodo actual
      await tx.periodo.update({
        where: { idPeriodo: idPeriodo },
        data: { activo: false },
      });

      // 2. Egresar a los de 6to (Esto está bien)
      const estudiantesSexto = await tx.estudiante.findMany({
        where: { semestre: 6 },
        select: { usuarioId: true },
      });
      const idsUsuariosSexto = estudiantesSexto.map((e) => e.usuarioId);
      if (idsUsuariosSexto.length > 0) {
        await tx.usuario.updateMany({
          where: { idUsuario: { in: idsUsuariosSexto } },
          data: { activo: false },
        });
      }

      // 3. PROMOCIÓN INTELIGENTE (1ro A -> 2do A)
      // Primero obtenemos a los estudiantes que van a subir
      const estudiantesAPromover = await tx.estudiante.findMany({
        where: { semestre: { lt: 6 }, usuario: { activo: true } },
        include: { grupo: true },
      });

      for (const estudiante of estudiantesAPromover) {
        if (estudiante.grupo) {
          // Buscamos el grupo del siguiente semestre con el mismo nombre (Ej: "A")
          const siguienteGrupo = await tx.grupo.findFirst({
            where: {
              nombre: estudiante.grupo.nombre, // Mismo nombre (A, B, C...)
              grado: estudiante.semestre + 1, // Grado superior
              especialidadId: estudiante.grupo.especialidadId, // Misma especialidad
            },
          });

          // Actualizamos al estudiante
          await tx.estudiante.update({
            where: { idEstudiante: estudiante.idEstudiante },
            data: {
              semestre: { increment: 1 },
              grupoId: siguienteGrupo ? siguienteGrupo.idGrupo : null,
              // Si no existe el grupo de 2A, lo deja en null, pero no lo borra a ciegas
            },
          });
        }
      }
    });

    res.status(200).json({ mensaje: "Promoción completada con éxito." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en la promoción." });
  }
};

module.exports = {
  crearPeriodo,
  getPeriodos,
  setPeriodoActual,
  cerrarPeriodoYPromover,
};
