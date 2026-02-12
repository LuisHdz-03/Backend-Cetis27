const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const crearGrupo = async (req, res) => {
  try {
    const { nombre, grado, turno, aula, periodoId, especialidadId } = req.body;

    if (!periodoId || !especialidadId) {
      return res
        .status(400)
        .json({ error: "Faltan IDs de Periodo o Especialidad" });
    }

    const nuevoGrupo = await prisma.grupo.create({
      data: {
        nombre,
        grado: parseInt(grado),
        turno,
        aula,
        periodoId: parseInt(periodoId),
        especialidadId: parseInt(especialidadId),
      },
    });

    res
      .status(201)
      .json({ mensaje: "Grupo creado exitosamente", grupo: nuevoGrupo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear grupo" });
  }
};

const getGrupos = async (req, res) => {
  try {
    const grupos = await prisma.grupo.findMany({
      include: {
        especialidad: {
          select: { nombre: true, codigo: true },
        },
        periodo: {
          select: { nombre: true },
        },
        _count: {
          select: { estudiantes: true },
        },
      },
      orderBy: {
        grado: "asc",
      },
    });
    res.json(grupos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener grupos" });
  }
};

const getGrupoById = async (req, res) => {
  const { id } = req.params;
  try {
    const grupo = await prisma.grupo.findUnique({
      where: { idGrupo: parseInt(id) },
      include: {
        estudiantes: {
          include: {
            usuario: {
              select: {
                nombre: true,
                apellidoPaterno: true,
                apellidoMaterno: true,
              },
            },
          },
          orderBy: { usuario: { apellidoPaterno: "asc" } },
        },
        especialidad: true,
      },
    });
    if (!grupo) return res.status(404).json({ error: "Grupo no encontrado" });
    res.json(grupo);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener detalle del grupo" });
  }
};

module.exports = { crearGrupo, getGrupos, getGrupoById };
