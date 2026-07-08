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
    if (qrProcesado && ahora - qrProcesado.procesadoEn < VENTANA_BLOQUEO_QR_MS) {
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

    const ultimoAcceso = await prisma.accesos.findFirst({
      where: { alumnoId: alumno.idEstudiante },
      orderBy: { fechaHora: "desc" },
    });

    let nuevoTipo = "ENTRADA";

    if (ultimoAcceso) {
      const fechaUltimo = new Date(ultimoAcceso.fechaHora);
      const fechaActual = new Date();
      const esMismoDia =
        fechaUltimo.toDateString() === fechaActual.toDateString();

      if (esMismoDia) {
        if (ultimoAcceso.tipo === "ENTRADA") {
          nuevoTipo = "SALIDA";
        }
      } else {
        nuevoTipo = "ENTRADA";
      }
    }

    const nuevoRegistro = await prisma.accesos.create({
      data: {
        tipo: nuevoTipo,
        alumnoId: alumno.idEstudiante,
      },
    });

    const respuesta = {
      mensaje: `Registro exitoso: ${nuevoTipo}`,
      tipo: nuevoTipo,
      alumno: `${alumno.usuario.nombre} ${alumno.usuario.apellidoPaterno}`,
      matricula: matricula,
      hora: new Date(),
    };

    qrProcesadosRecientemente.set(tokenQR, {
      procesadoEn: ahora,
      respuesta,
      accesoId: nuevoRegistro.idAcceso,
    });

    res.json(respuesta);
  } catch (error) {
    res.status(500).json({ error: "Error al registrar acceso" });
  }
};

const getAccesos = async (req, res) => {
  try {
    const accesos = await prisma.accesos.findMany({
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
              select: {
                nombre: true,
              },
            },
          },
        },
      },
      orderBy: {
        fechaHora: "desc",
      },
    });
    res.json(accesos);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener los accesos" });
  }
};
module.exports = { registrarAcceso, getAccesos };
