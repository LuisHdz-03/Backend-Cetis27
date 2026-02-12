const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const getBitacora = async (req, res) => {
  try {
    const logs = await prisma.bitacora.findMany({
      take: 100,
      orderBy: { fecha: "desc" },
      include: {
        usuario: {
          select: { nombre: true, apellidoPaterno: true, rol: true },
        },
      },
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: "Error al leer bitácora." });
  }
};

const registrarAccion = async (usuarioId, accion, detalle) => {
  try {
    await prisma.bitacora.create({
      data: {
        usuarioId: parseInt(usuarioId),
        accion,
        detalle,
      },
    });
  } catch (error) {
    console.error("No se pudo guardar en bitácora:", error);
  }
};

module.exports = { getBitacora, registrarAccion };
