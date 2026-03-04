const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

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
    const periodos = await prisma.periodo.findMany({
      orderBy: { fechaInicio: "desc" },
    });
    res.json(periodos);
  } catch (error) {
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

const avanzarSemestre = async (req, res) => {
  try {
    await prisma.$transaction(async (tx) => {
      //buscamos al alumno y lo subimos de semestre y si egreso lo desactivamos.
      const estudiantes = await tx.estudiante.findMany();

      for (const alum of estudiantes) {
        if (alum.semestre >= 6) {
          await tx.estudiante.update({
            where: { idEstudiante: alum.idEstudiante },
            data: { activo: false, semestre: 7 },
          });
        } else {
          await tx.estudiante.update({
            where: { idEstudiante: alum.idEstudiante },
            data: { data: alum.semestre + 1 },
          });
        }
      }

      //buscamos los grupos y los subimos de mesestre.

      const grupos = await tx.grupo.findMany();

      for (const grupo of grupos) {
        if (grupo.grado >= 6) {
          await tx.grupo.delete({
            where: { idGrupo: grupo.idGrupo },
          });
        } else {
          const nuevoGrado = grupo.grado + 1;
          const nuevoNombre = grupo.nombre.replace(/^\d+/, nuevoGrado);

          await tx.grupo.update({
            where: { idGrupo: grupo.idGrupo },
            data: {
              grado: nuevoGrado,
              nombre: nuevoNombre,
            },
          });
        }
      }
    });

    res.status(200).json({
      ok: true,
      msg: "Cierre de semestre exitoso!!",
    });
  } catch (error) {
    console.error("Error crítico en el cierre de semestre:", error);
    res
      .status(500)
      .json({ error: "Error al procesar la transición de semestre." });
  }
};

module.exports = {
  crearPeriodo,
  getPeriodos,
  setPeriodoActual,
  avanzarSemestre,
};
