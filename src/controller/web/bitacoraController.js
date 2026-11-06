const prisma = require("../../config/prisma");

const extraerIpDesdeDetalle = (detalle = "") => {
  const match = String(detalle).match(/IP:\s*([^|]+)/i);
  return match ? match[1].trim() : "N/D";
};

const formatearDetalle = (detalle = "") => {
  if (!detalle) return "Sin detalles registrados";

  try {
    if (typeof detalle === "string" && (detalle.startsWith("{") || detalle.startsWith("["))) {
      const parsed = JSON.parse(detalle);
      if (parsed.message) return parsed.message;
      return JSON.stringify(parsed, null, 2);
    }
  } catch (e) {}

  let textoLimpio = String(detalle).trim();
  textoLimpio = textoLimpio.replace(/\|\s*IP:\s*[^|]+/gi, "").trim();

  return textoLimpio || "Acción realizada correctamente";
};

const getBitacora = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    const { usuarioId, accion, busqueda } = req.query;
    const where = {};

    if (usuarioId) where.usuarioId = parseInt(usuarioId);
    if (accion) where.accion = accion;
    if (busqueda) {
      where.OR = [
        { accion: { contains: busqueda, mode: "insensitive" } },
        { detalle: { contains: busqueda, mode: "insensitive" } },
        {
          usuario: {
            nombre: { contains: busqueda, mode: "insensitive" },
          },
        },
        {
          usuario: {
            apellidoPaterno: { contains: busqueda, mode: "insensitive" },
          },
        },
      ];
    }

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
      detalles: formatearDetalle(log.detalle),
      fechaHora: log.fecha,
      ipBase: extraerIpDesdeDetalle(log.detalle),
      usuario: log.usuario,
    }));

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

/**
 * Función principal para registrar acciones importantes.
 * Filtra automáticamente logins móviles innecesarios y asegura formato limpio.
 */
const registrarAccion = async (usuarioId, accion, detalle) => {
  try {
    if (!usuarioId) return;

    // Ignorar inicios de sesión desde la app móvil para no saturar con ruido
    if (accion === "LOGIN" && String(detalle).includes("MOVIL")) {
      return; 
    }

    let detalleFinal = detalle;
    if (typeof detalle === "object") {
      detalleFinal = JSON.stringify(detalle);
    }

    await prisma.bitacora.create({
      data: {
        usuarioId: parseInt(usuarioId),
        accion: accion.toUpperCase(), // Ej: CREAR, ACTUALIZAR, ELIMINAR, LOGIN
        detalle: detalleFinal,
      },
    });
  } catch (error) {
    console.error("Error al registrar en bitácora:", error);
  }
};

module.exports = { getBitacora, registrarAccion };