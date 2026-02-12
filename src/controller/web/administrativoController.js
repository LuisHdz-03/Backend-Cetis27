const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const crearAdministrativo = async (req, res) => {
  try {
    const {
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      email,
      password,
      cargo,
      area,
      numeroEmpleado,
      rol,
    } = req.body;

    const rolesPermitidos = ["ADMINISTRATIVO", "DIRECTIVO", "GUARDIA"];

    const rolAsignar = rol ? rol.toUpperCase() : "ADMINISTRATIVO";

    if (!rolesPermitidos.includes(rolAsignar)) {
      return res.status(400).json({
        error: `El rol '${rolAsignar}' no es válido para este perfil. Usa: ${rolesPermitidos.join(", ")}`,
      });
    }

    const nuevoAdmin = await prisma.$transaction(async (prisma) => {
      const usuario = await prisma.usuario.create({
        data: {
          nombre,
          apellidoPaterno,
          apellidoMaterno,
          email,
          password,
          rol: rolAsignar,
          activo: true,
        },
      });

      const perfil = await prisma.administrativo.create({
        data: {
          numeroEmpleado,
          cargo,
          area,
          usuarioId: usuario.idUsuario,
        },
      });

      return { usuario, perfil };
    });

    res.status(201).json({
      mensaje: `Personal registrado correctamente como ${rolAsignar}`,
      data: nuevoAdmin,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al registrar personal." });
  }
};

const getAdministrativos = async (req, res) => {
  try {
    const admins = await prisma.administrativo.findMany({
      include: {
        usuario: {
          select: {
            nombre: true,
            apellidoPaterno: true,
            email: true,
            rol: true,
            activo: true,
          },
        },
      },
    });
    res.json(admins);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener lista." });
  }
};

module.exports = { crearAdministrativo, getAdministrativos };
