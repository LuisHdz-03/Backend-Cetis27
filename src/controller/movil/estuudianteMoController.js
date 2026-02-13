const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const getAlumnosMovil = async (req, res) => {
  try {
    const idUsuario = req.usuario.id;

    const estudiante = await prisma.estudiante.findUnique({
      where: {
        usuarioId: idUsuario,
      },
      include: {
        usuario: {
          select: {
            nombre: true,
            apellidoPaterno: true,
            apellidoMaterno: true,
            email: true,
          },
        },
        tutor: {
          select: {
            nombre: true,
            apellidoPaterno: true,
            telefono: true,
            parentesco: true,
          },
        },
        grupo: {
          select: {
            nombre: true,
            grado: true,
            turno: true,
            especialidad: { select: { nombre: true } },
          },
        },
      },
    });
    if (!estudiante) {
      return res.status(404).json({ mensaje: "perfil no encontrado." });
    }
    res.json(estudiante);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al encontrar el perfil." });
  }
};

module.exports = { getAlumnosMovil };
