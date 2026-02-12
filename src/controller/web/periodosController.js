const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const crearPeriodo = async (req, res) => {
  try {
    const { nombre, codigo, fechaInicio, fechaFin } = req.body;

    const nuevoPeriodo = await prisma.periodo.create({
      data: {
        nombre,
        codigo,
        fechaInicio: new Date(fechaInicio),
        fechaFin: new Date(fechaFin),
        activo: false,
      },
    });

    res.status(201).json(nuevoPeriodo);
  } catch (error) {
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

module.exports = { crearPeriodo, getPeriodos, setPeriodoActual };
