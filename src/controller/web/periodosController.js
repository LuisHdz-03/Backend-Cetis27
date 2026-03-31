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
      where: whereClause, // 3. Aplicamos el filtro a la consulta
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

  if (isNaN(idPeriodo)) {
    return res.status(400).json({ error: "ID de periodo inválido" });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Desactivar el periodo actual
      await tx.periodo.update({
        where: { idPeriodo: idPeriodo },
        data: { activo: false },
      });

      // 2. Buscar alumnos de 6to semestre y egresarlos (desactivarlos)
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

      // 3. Promover alumnos de 1ro a 5to semestre
      await tx.estudiante.updateMany({
        where: {
          semestre: { lt: 6 },
          usuario: { activo: true },
        },
        data: {
          semestre: { increment: 1 },
          // ELIMINAMOS grupoId: null PARA QUE SE QUEDEN EN SU GRUPO Y SU ESPECIALIDAD
        },
      });

      // 4. Promover los Grupos (Subir grado y cambiar nombre de 1A a 2A)
      const gruposPromover = await tx.grupo.findMany({
        where: {
          periodoId: idPeriodo, // Afectar solo a los grupos de este periodo
          grado: { lt: 6 }, // Solo grupos de 1ro a 5to
        },
      });

      for (const grupo of gruposPromover) {
        // Busca el primer número en el nombre del grupo y le suma 1 (Ej: "1A" pasa a "2A", "3B Contabilidad" pasa a "4B Contabilidad")
        const nuevoNombre = grupo.nombre.replace(
          /\d+/,
          (match) => parseInt(match) + 1,
        );

        await tx.grupo.update({
          where: { idGrupo: grupo.idGrupo },
          data: {
            grado: { increment: 1 },
            nombre: nuevoNombre,
          },
        });
      }
    });

    res.status(200).json({
      mensaje:
        "Periodo cerrado correctamente. Estudiantes promovidos y grupos actualizados al siguiente semestre.",
    });
  } catch (error) {
    console.error("Error al cerrar periodo:", error);
    res.status(500).json({ error: "Error interno al cerrar el periodo." });
  }
};

module.exports = {
  crearPeriodo,
  getPeriodos,
  setPeriodoActual,
  cerrarPeriodoYPromover,
};
