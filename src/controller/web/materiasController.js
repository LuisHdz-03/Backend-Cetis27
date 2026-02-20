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

const eliminarMateria = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.materia.delete({
      where: {
        idMateria: parseInt(id),
      },
    });

    res.json({ mensaje: "Materia eliminada correctamente" });
  } catch (error) {
    console.error(error);
    if (error.code === "P2003") {
      return res.status(400).json({
        error:
          "No se puede eliminar la materia por que esta asisgnada a un grupo",
      });
    }
    res.status(500).json({ error: "Error al eliminar la materia" });
  }
};

module.exports = { crearMateria, getMateria, eliminarMateria };
