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
  const idPeriodoCerrar = parseInt(id);

  try {
    const resultado = await prisma.$transaction(
      async (tx) => {
        // 1. Buscamos el periodo que acaba de quedar activo
        const periodoDestino = await tx.periodo.findFirst({
          where: { activo: true },
        });

        if (!periodoDestino) {
          throw new Error(
            "Primero debes crear y activar el nuevo periodo (el siguiente semestre).",
          );
        }

        // 2. Desactivamos el periodo viejo
        await tx.periodo.update({
          where: { idPeriodo: idPeriodoCerrar },
          data: { activo: false },
        });

        // 3. Egresar 6to semestre (Desactivar usuarios)
        const alumnosSexto = await tx.estudiante.findMany({
          where: { semestre: 6, usuario: { activo: true } },
          select: { usuarioId: true },
        });

        if (alumnosSexto.length > 0) {
          await tx.usuario.updateMany({
            where: { idUsuario: { in: alumnosSexto.map((a) => a.usuarioId) } },
            data: { activo: false },
          });
        }

        // 4. Promoción Inteligente (Optimizado)
        const estudiantes = await tx.estudiante.findMany({
          where: { semestre: { lt: 6 }, usuario: { activo: true } },
          include: { grupo: true },
        });

        // Usamos Promise.all para que sea más rápido y no sature la transacción
        const promesasPromocion = estudiantes.map(async (estudiante) => {
          let nuevoGrupoId = null;

          if (estudiante.grupo) {
            // Buscamos el grupo par en el periodo destino (Ej: de 1A a 2A)
            const grupoPar = await tx.grupo.findFirst({
              where: {
                nombre: estudiante.grupo.nombre,
                grado: estudiante.semestre + 1,
                especialidadId: estudiante.grupo.especialidadId,
                periodoId: periodoDestino.idPeriodo,
              },
            });
            if (grupoPar) nuevoGrupoId = grupoPar.idGrupo;
          }

          return tx.estudiante.update({
            where: { idEstudiante: estudiante.idEstudiante },
            data: {
              semestre: { increment: 1 },
              grupoId: nuevoGrupoId, // Si no hay grupo par, queda en null pero sube de semestre
            },
          });
        });

        await Promise.all(promesasPromocion);

        return {
          conteo: estudiantes.length,
          periodoNuevo: periodoDestino.nombre,
        };
      },
      {
        timeout: 10000, // Aumentamos el tiempo de espera de la transacción a 10 segundos
      },
    );

    res.json({
      mensaje: `Éxito. Se promovieron ${resultado.conteo} alumnos al periodo ${resultado.periodoNuevo}.`,
    });
  } catch (error) {
    console.error("DETALLE DEL ERROR:", error);
    res
      .status(500)
      .json({ error: error.message || "Error interno al procesar promoción" });
  }
};

module.exports = {
  crearPeriodo,
  getPeriodos,
  setPeriodoActual,
  cerrarPeriodoYPromover,
};
