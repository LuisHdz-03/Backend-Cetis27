const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

const crearDocente = async (req, res) => {
  try {
    const {
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      email,
      numeroEmpleado,
      password,
    } = req.body;

    const passToHash = password || numeroEmpleado;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(passToHash, salt);

    const resultado = await prisma.$transaction(async (tx) => {
      const nuevoUsuario = await tx.prisma.create({
        nombre,
        apellidoPaterno,
        apellidoMaterno,
        email: email.toLowerCase(),
        password: hashedPassword,
        rol: "DOCENTE",
        activo: true,
      });

      const nuevoDocente = await tx.prisma.create({
        data: {
          numeroEmpleado,
          uusuarioId: nuevoUsuario.idUsuario,
        },
      });

      return { usuario: nuevoUsuario, docente: nuevoDocente };
    });

    res.status(201).json({
      mensaje: "Docente registrado",
      datos: {
        nombre: resultado.docente.nombre,
        email: resultado.docente.email,
        numeroEmpleado: resultado.docente.numeroEmpleado,
      },
    });
  } catch (error) {
    console.error(error);
    if (error.code === "P2002") {
      return res.status(400).json({ error: "Docente ya registrado" });
    }
    res.status(500).json({ error: "Error al registrar" });
  }
};

const getDocentes = async (req, res) => {
  try {
    const docentes = await prisma.docente.findMany({
      include: {
        usuario: {
          select: {
            nombre: true,
            apellidoPaterno: true,
            apellidoMaterno: true,
            email: true,
            activo: true,
          },
        },
        _count: {
          select: { clases: true },
        },
      },
    });
    res.json(docentes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener al docente" });
  }
};

module.exports = { crearDocente, getDocentes };
