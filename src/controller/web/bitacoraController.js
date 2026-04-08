const prisma = require("../../config/prisma");

const extraerIpDesdeDetalle = (detalle = "") => {
  const match = String(detalle).match(/IP:\s*([^|]+)/i);
  return match ? match[1].trim() : "N/D";
};

const getBitacora = async (req, res) => {
  try {
    const logs = await prisma.bitacora.findMany({
      take: 100,
      orderBy: { fecha: "desc" },
      include: {
        usuario: {
          select: {
            nombre: true,
            apellidoPaterno: true,
            email: true,
            rol: true,
          },
        },
      },
    });

    // Adaptamos los nombres de la BD a lo que pide React
    const logsMapeados = logs.map((log) => ({
      idBitacora: log.idBitacora || log.id,
      accion: log.accion,
      detalles: log.detalle, // Adaptación aquí
      fechaHora: log.fecha, // Adaptación aquí
      ipBase: extraerIpDesdeDetalle(log.detalle),
      usuario: log.usuario,
    }));

    res.json(logsMapeados);
  } catch (error) {
    console.error("Error en getBitacora:", error);
    res.status(500).json({ error: "Error al leer bitácora." });
  }
};

const registrarAccion = async (usuarioId, accion, detalle) => {
  try {
    if (!usuarioId) return;

    await prisma.bitacora.create({
      data: {
        usuarioId: parseInt(usuarioId),
        accion: accion,
        detalle: detalle,
      },
    });
  } catch (error) {
    console.error("No se pudo guardar en bitácora:", error);
  }
};

module.exports = { getBitacora, registrarAccion };
