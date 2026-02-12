const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const crearMateria = async (req, res) => {
  try {
    const { nombre, codigo, horasSemana, semestre, especialidadId } = req.body;

    const existe = await prisma.materia.findFirst({
      where: { codigo: codigo },
    });

    if (existe) {
      return res.status(400).json({ error: "La materia ya existe" });
    }

    const nuevaMateria = await prisma.materia.create({
      data: {
        nombre,
        codigo,
        horasSemana: parseInt(horasSemana),
        semestre: parseInt(semestre),
        especialidadId: especialidadId ? parseInt(especialidadId) : null,
      },
    });

    res
      .status(201)
      .json({ mensaje: "Materia nueva creada", materia: nuevaMateria });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "error al crear la materia" });
  }
};

const getMateria = async (req, res) => {
  try {
    const materias = await prisma.materia.findMany({
      include: {
        especialidad: {
          select: { nombre: true },
        },
      },
    });
    res.json(materias);
  } catch (error) {
    res.status(500).json({ error: "error al obtener las materias" });
  }
};

module.exports = { crearMateria, getMateria };
