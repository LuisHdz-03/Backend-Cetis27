const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const crearEspecialidad = async (req, res) => {
  try {
    const { nombre, codigo } = req.body;
    const nueva = await prisma.especialidad.create({
      data: { nombre, codigo },
    });
    res.status(201).json(nueva);
  } catch (error) {
    res.status(500).json({ error: "No se pudo crear una nueva especialidad" });
  }
};

const getEspecialidad = async (req, res) => {
  try {
    const lista = await prisma.especialidad.findMany({
      include: {
        _count: { select: { grupos: true } },
      },
    });
    res.json(lista);
  } catch (error) {
    res.status(500).json({ error: "No se pudo obtener las especialidades" });
  }
};

module.exports = { crearEspecialidad, getEspecialidad };
