const prisma = require("../../config/prisma");

const registrarAcceso = async (req, res) => {
  try {
    const { tokenQR } = req.body;

    if (!tokenQR || !tokenQR.includes("|")) {
      return res.status(400).json({ error: "Formato de QR inválido" });
    }

    const [matricula, timestampQR] = tokenQR.split("|");

    const ahora = Date.now();
    const tiempoQR = parseInt(timestampQR);
    const diferencia = ahora - tiempoQR;

    if (diferencia > 60000 || diferencia < -5000) {
      return res.status(401).json({
        error: "Código QR expirado o inválido. Genere uno nuevo.",
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

    const ultimoAcceso = await prisma.aceesos.findFirst({
      where: { alumnoId: alumno.idEstudiante },
      orderBy: { fechaHora: "desc" },
    });

    let nuevoTipo = "ENTRADA";

    if (ultimoAcceso) {
      const fechaUltimo = new Date(ultimoAcceso.fechaHora);
      const fechaActual = new Date();

      // ---> ESCUDO ANTI-DOBLE ESCANEO AGREGADO AQUÍ <---
      // Si la diferencia es menor a 2 minutos (120,000 milisegundos), se bloquea.
      const tiempoDesdeUltimoAcceso =
        fechaActual.getTime() - fechaUltimo.getTime();
      if (tiempoDesdeUltimoAcceso < 120000) {
        return res.status(429).json({
          error:
            "Acceso ya registrado hace un momento. Por favor espere 2 minutos para volver a escanear.",
          tipo_registrado: ultimoAcceso.tipo,
        });
      }
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

    const nuevoRegistro = await prisma.aceesos.create({
      data: {
        tipo: nuevoTipo,
        alumnoId: alumno.idEstudiante,
      },
    });

    res.json({
      mensaje: `Registro exitoso: ${nuevoTipo}`,
      tipo: nuevoTipo,
      alumno: `${alumno.usuario.nombre} ${alumno.usuario.apellidoPaterno}`,
      matricula: matricula,
      hora: new Date(),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al registrar acceso" });
  }
};

const getAccesos = async (req, res) => {
  try {
    const accesos = await prisma.aceesos.findMany({
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
    console.error(error);
    res.status(500).json({ mensaje: "Error al obtener los accesos" });
  }
};
module.exports = { registrarAcceso, getAccesos };
