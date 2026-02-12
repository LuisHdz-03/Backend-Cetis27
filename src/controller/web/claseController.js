const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const crearClase = async (req, res) => {
  try {
    const { grupoId, materiaId, docenteId, horario } = req.body;

    if (!grupoId || !materiaId || !docenteId) {
      return res.status(400).json({ error: "Faltan datos" });
    }

    const nuevaClase = await prisma.clase.create({
      data: {
        grupoId: parseInt(grupoId),
        materiaId: parseInt(materiaId),
        docenteId: parseInt(docenteId),
        horario: horario,
      },
    });
    res
      .status(201)
      .json({ mensaje: "Clase creada con exito", clase: nuevaClase });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear la clase" });
  }
};

const getClase = async (req, res) => {
  try {
    const clase = await prisma.clase.findMany({
      include: {
        grupo: {
          select: {
            nombre: true,
            grado: true,
            turno: true,
          },
        },
        materias: {
          select: {
            nombre: true,
            codigo: true,
          },
        },
        docente: {
          include: {
            usuario: {
              select: {
                nombre: true,
                apellidoPaterno: true,
              },
            },
          },
        },
      },
    });
    res.json(clase);
  } catch (error) {
    res.status(500).json({ error: "No se pudieron traer las clases" });
  }
};

const getClaseByDocente = async (req, res) => {
  const { idDocente } = req.params;
  try {
    const clases = await prisma.clase.findMany({
      where: { docenteId: parseInt(idDocente) },
      include: {
        grupo: true,
        materias: true,
      },
    });
    res.json(clases);
  } catch (error) {
    res.status(500).json({ error: "No se pudo obtener la carga academica" });
  }
};

module.exports = { crearClase, getClase, getClaseByDocente };
