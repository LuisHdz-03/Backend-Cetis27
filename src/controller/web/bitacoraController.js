const prisma = require("../../config/prisma");

const extraerIpDesdeDetalle = (detalle = "") => {
  const match = String(detalle).match(/IP:\s*([^|]+)/i);
  return match ? match[1].trim() : "N/D";
};

const getBitacora = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    const { usuarioId, accion } = req.query;
    const where = {};

    if (usuarioId) where.usuarioId = parseInt(usuarioId);
    if (accion) where.accion = accion;

    const [logs, totalRegistros] = await Promise.all([
      prisma.bitacora.findMany({
        where,
        take: limit,
        skip: skip,
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
      }),
      prisma.bitacora.count({ where }),
    ]);

    const logsMapeados = logs.map((log) => ({
      idBitacora: log.idBitacora || log.id,
      accion: log.accion,
      detalles: log.detalle,
      fechaHora: log.fecha,
      ipBase: extraerIpDesdeDetalle(log.detalle),
      usuario: log.usuario,
    }));

    // Retornamos el formato paginado
    res.json({
      data: logsMapeados,
      pagination: {
        totalRegistros,
        totalPages: Math.ceil(totalRegistros / limit),
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
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
  } catch (error) {}
};

module.exports = { getBitacora, registrarAccion };
