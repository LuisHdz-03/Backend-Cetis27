const prisma = require("../../config/prisma");

const VENTANA_BLOQUEO_QR_MS = 2 * 60 * 1000;
const VENTANA_EXPIRACION_QR_MS = 60 * 1000;
const TOLERANCIA_RELOJ_QR_MS = 5 * 1000;
const qrProcesadosRecientemente = new Map();

const limpiarQrProcesadosExpirados = (ahora) => {
  for (const [token, datos] of qrProcesadosRecientemente.entries()) {
    if (ahora - datos.procesadoEn >= VENTANA_BLOQUEO_QR_MS) {
      qrProcesadosRecientemente.delete(token);
    }
  }
};

const esMismoDia = (fechaA, fechaB) => {
  return (
    fechaA.getFullYear() === fechaB.getFullYear() &&
    fechaA.getMonth() === fechaB.getMonth() &&
    fechaA.getDate() === fechaB.getDate()
  );
};

const registrarAcceso = async (req, res) => {
  try {
    const tokenQR = String(req.body?.tokenQR || "").trim();

    if (!tokenQR || !tokenQR.includes("|")) {
      return res.status(400).json({ error: "Formato de QR inválido" });
    }

    const [matriculaCruda, timestampQR] = tokenQR.split("|");
    const matricula = String(matriculaCruda || "").trim();

    const ahora = Date.now();
    const tiempoQR = parseInt(timestampQR, 10);
    const diferencia = ahora - tiempoQR;

    limpiarQrProcesadosExpirados(ahora);

    if (
      Number.isNaN(tiempoQR) ||
      diferencia > VENTANA_EXPIRACION_QR_MS ||
      diferencia < -TOLERANCIA_RELOJ_QR_MS
    ) {
      qrProcesadosRecientemente.delete(tokenQR);
      return res.status(401).json({
        error: "Código QR expirado o inválido. Genere uno nuevo.",
      });
    }

    const qrProcesado = qrProcesadosRecientemente.get(tokenQR);
    if (
      qrProcesado &&
      ahora - qrProcesado.procesadoEn < VENTANA_BLOQUEO_QR_MS
    ) {
      return res.json({
        ...qrProcesado.respuesta,
        duplicado: true,
        mensaje: "Este código QR ya fue procesado hace un momento.",
        bloqueadoHasta: new Date(
          qrProcesado.procesadoEn + VENTANA_BLOQUEO_QR_MS,
        ),
      });
    }

    const alumno = await prisma.estudiante.findUnique({
      where: { matricula: matricula },
      include: {
        usuario: {
          select: { nombre: true, apellidoPaterno: true },
        },
      },
    });

    if (!alumno) {
      return res.status(404).json({ mensaje: "Matricula no encontrada" });
    }

    const nuevoRegistro = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${alumno.idEstudiante})`;

      const ultimoAcceso = await tx.accesos.findFirst({
        where: { alumnoId: alumno.idEstudiante },
        orderBy: { fechaHora: "desc" },
      });

      let nuevoTipo = "ENTRADA";

      if (ultimoAcceso) {
        const fechaUltimo = new Date(ultimoAcceso.fechaHora);
        const fechaActual = new Date();

        if (
          esMismoDia(fechaUltimo, fechaActual) &&
          ultimoAcceso.tipo === "ENTRADA"
        ) {
          nuevoTipo = "SALIDA";
        }
      }

      return tx.accesos.create({
        data: {
          tipo: nuevoTipo,
          alumnoId: alumno.idEstudiante,
        },
      });
    });

    const respuesta = {
      mensaje: `Registro exitoso: ${nuevoRegistro.tipo}`,
      tipo: nuevoRegistro.tipo,
      alumno: `${alumno.usuario.nombre} ${alumno.usuario.apellidoPaterno}`,
      matricula: matricula,
      hora: nuevoRegistro.fechaHora,
    };

    qrProcesadosRecientemente.set(tokenQR, {
      procesadoEn: ahora,
      respuesta,
      accesoId: nuevoRegistro.idAcceso,
    });

    res.json(respuesta);
  } catch (error) {
    console.error("Error en registrarAcceso:", error);
    res.status(500).json({ error: "Error al registrar acceso" });
  }
};

const getAccesos = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const { fechaInicio, fechaFin, busqueda, grupo, tipo } = req.query;
    const where = {};
    const andConditions = [];

    if (busqueda) {
      andConditions.push({
        OR: [
          {
            alumno: { matricula: { contains: busqueda, mode: "insensitive" } },
          },
          {
            alumno: {
              usuario: { nombre: { contains: busqueda, mode: "insensitive" } },
            },
          },
          {
            alumno: {
              usuario: {
                apellidoPaterno: { contains: busqueda, mode: "insensitive" },
              },
            },
          },
        ],
      });
    }

    if (grupo) {
      andConditions.push({
        alumno: { grupo: { nombre: grupo } },
      });
    }

    if (tipo) {
      andConditions.push({ tipo: tipo.toUpperCase() });
    }

    if (fechaInicio || fechaFin) {
      const rangoFecha = {};
      if (fechaInicio) {
        rangoFecha.gte = new Date(`${fechaInicio}T00:00:00.000-06:00`);
      }
      if (fechaFin) {
        rangoFecha.lte = new Date(`${fechaFin}T23:59:59.999-06:00`);
      }
      andConditions.push({ fechaHora: rangoFecha });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const [accesos, totalRegistros] = await Promise.all([
      prisma.accesos.findMany({
        where,
        skip,
        take: limit,
        include: {
          alumno: {
            select: {
              matricula: true,
              usuario: {
                select: {
                  nombre: true,
                  apellidoPaterno: true,
                  apellidoMaterno: true,
                },
              },
              grupo: {
                select: { nombre: true },
              },
            },
          },
        },
        orderBy: {
          fechaHora: "desc",
        },
      }),
      prisma.accesos.count({ where }),
    ]);

    res.json({
      data: accesos,
      pagination: {
        totalRegistros,
        totalPages: Math.ceil(totalRegistros / limit),
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener los accesos" });
  }
};

module.exports = { registrarAcceso, getAccesos };
