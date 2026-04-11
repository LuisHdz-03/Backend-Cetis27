// Permite al alumno actualizar su correo, teléfono y dirección desde la app móvil
const actualizarDatosContacto = async (req, res) => {
  try {
    const idUsuario = req.usuario.id;
    const { email, telefono, direccion } = req.body;

    if (email === undefined && telefono === undefined && direccion === undefined) {
      return res.status(400).json({ error: "Debes enviar al menos uno de estos campos: email, telefono, direccion" });
    }

    const dataUpdate = {};
    if (email !== undefined) {
      const emailNormalizado = String(email || "").trim().toLowerCase();
      if (!emailNormalizado) {
        return res.status(400).json({ error: "El correo no puede estar vacío" });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailNormalizado)) {
        return res.status(400).json({ error: "El formato del correo no es válido" });
      }
      dataUpdate.email = emailNormalizado;
    }
    if (telefono !== undefined) {
      const telefonoNormalizado = String(telefono || "").trim();
      if (!telefonoNormalizado) {
        return res.status(400).json({ error: "El teléfono no puede estar vacío" });
      }
      const telefonoRegex = /^\d{10}$/;
      if (!telefonoRegex.test(telefonoNormalizado)) {
        return res.status(400).json({ error: "El teléfono debe tener 10 dígitos" });
      }
      dataUpdate.telefono = telefonoNormalizado;
    }
    if (direccion !== undefined) {
      const direccionNormalizada = String(direccion || "").trim();
      if (!direccionNormalizada) {
        return res.status(400).json({ error: "La dirección no puede estar vacía" });
      }
      dataUpdate.direccion = direccionNormalizada;
    }

    const usuarioActualizado = await prisma.usuario.update({
      where: { idUsuario },
      data: dataUpdate,
      select: {
        idUsuario: true,
        email: true,
        telefono: true,
        direccion: true,
      },
    });

    return res.json({
      ok: true,
      mensaje: "Datos de contacto actualizados correctamente",
      usuario: usuarioActualizado,
    });
  } catch (error) {
    console.error("Error al actualizar datos de contacto:", error);
    res.status(500).json({ error: "Error al actualizar los datos de contacto" });
  }
};
const prisma = require("../../config/prisma");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const sharp = require("sharp");
const fs = require("fs");
const QRCode = require("qrcode");
const cloudinary = require("cloudinary").v2;

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET no está configurada en variables de entorno");
  }
  return process.env.JWT_SECRET;
};
const CREDENCIAL_DISENIO_FILE = path.join(
  __dirname,
  "../../../public/uploads/credencial/disenio-app-movil.json",
);

const obtenerFirmanteCredencial = async () => {
  const director = await prisma.administrativo.findFirst({
    where: {
      cargo: { in: ["DIRECTOR", "DIRECTORA"] },
      usuario: { activo: true },
    },
    select: {
      cargo: true,
      firmaImagenUrl: true,
      usuario: {
        select: {
          nombre: true,
          apellidoPaterno: true,
          apellidoMaterno: true,
        },
      },
    },
    orderBy: { idAdministrativo: "desc" },
  });

  if (!director || !director.usuario) {
    return {
      cargo: "DIRECCION DEL PLANTEL",
      nombre: null,
      firmaImagenUrl: null,
      fuente: "fallback",
    };
  }

  const nombreCompleto = [
    director.usuario.nombre,
    director.usuario.apellidoPaterno,
    director.usuario.apellidoMaterno,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    cargo: director.cargo,
    nombre: nombreCompleto || null,
    firmaImagenUrl: director.firmaImagenUrl || null,
    fuente: "administrativo_activo",
  };
};

const guardarDisenioCredencialMovil = async (req, res) => {
  try {
    const syncKey = req.headers["x-layout-sync-key"];

    if (!process.env.CREDENCIAL_SYNC_KEY) {
      return res.status(503).json({
        error:
          "No está configurada la variable CREDENCIAL_SYNC_KEY en el servidor.",
      });
    }

    if (!syncKey || syncKey !== process.env.CREDENCIAL_SYNC_KEY) {
      return res
        .status(401)
        .json({ error: "Clave de sincronización inválida." });
    }

    const { diseno, appVersion, plataforma } = req.body;

    if (!diseno || typeof diseno !== "object" || Array.isArray(diseno)) {
      return res.status(400).json({
        error: "Debes enviar un objeto 'diseno' válido en el body.",
      });
    }

    const payload = {
      appVersion: appVersion || "desconocida",
      plataforma: plataforma || "MOVIL",
      sincronizadoEn: new Date().toISOString(),
      sincronizadoPor: {
        idUsuario: req.usuario?.id || null,
        rol: req.usuario?.rol || null,
      },
      diseno,
    };

    const directorio = path.dirname(CREDENCIAL_DISENIO_FILE);
    fs.mkdirSync(directorio, { recursive: true });
    fs.writeFileSync(
      CREDENCIAL_DISENIO_FILE,
      JSON.stringify(payload, null, 2),
      "utf8",
    );

    return res.json({
      mensaje: "Diseño de credencial móvil sincronizado correctamente.",
      archivo: "/uploads/credencial/disenio-app-movil.json",
      appVersion: payload.appVersion,
      sincronizadoEn: payload.sincronizadoEn,
    });
  } catch (error) {
    console.error("Error guardando diseño de credencial móvil:", error);
    return res
      .status(500)
      .json({ error: "No se pudo guardar el diseño de credencial." });
  }
};

//configuracion del cloudinary

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
if (
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  console.error(
    "⚠️  Faltan variables de entorno de Cloudinary: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET",
  );
}

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
            telefono: true,
            direccion: true,
            curp: true,
          },
        },
        tutor: {
          select: {
            nombre: true,
            apellidoPaterno: true,
            apellidoMaterno: true,
            telefono: true,
            parentesco: true,
            direccion: true,
            email: true,
          },
        },
        grupo: {
          select: {
            nombre: true,
            grado: true,
            turno: true,
            especialidad: { select: { nombre: true } },
            clases: {
              where: {
                periodo: { activo: true }, 
              },
              include: {
                materias: true,
                docente: {
                  include: {
                    usuario: {
                      select: { nombre: true, apellidoPaterno: true },
                    },
                  },
                },
              },
            },
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

const uploadFotiko = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ mensaje: "No se encontró ninguna imagen" });
    }

    const idUsuario = req.usuario.id;

    const bufferProcesado = await sharp(req.file.buffer)
      .resize(500, 500, {
        fit: "cover",
        position: "attention",
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    const uploadToCloudinary = (buffer) => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: "fotos_chavales_cetis27" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          },
        );
        uploadStream.end(buffer);
      });
    };

    const resultCloudinary = await uploadToCloudinary(bufferProcesado);
    const nuevaFtUrl = resultCloudinary.secure_url;

    const estudiantePrevio = await prisma.estudiante.findUnique({
      where: { usuarioId: idUsuario },
      select: { fotoUrl: true },
    });

    if (
      estudiantePrevio?.fotoUrl &&
      estudiantePrevio.fotoUrl.includes("cloudinary")
    ) {
      try {
        const urlParts = estudiantePrevio.fotoUrl.split("/");
        const archivo = urlParts.pop().split(".")[0];
        const carpeta = urlParts.pop();
        const publicId = `${carpeta}/${archivo}`;

        await cloudinary.uploader.destroy(publicId);
        console.log(`Foto vieja eliminada de Cloudinary: ${publicId}`);
      } catch (e) {
        console.error("Error al borrar foto vieja en Cloudinary:", e);
      }
    }

    const estudianteActualizado = await prisma.estudiante.update({
      where: { usuarioId: idUsuario },
      data: { fotoUrl: nuevaFtUrl },
    });

    res.json({
      mensaje: "Foto actualizada correctamente en la nube",
      fotoUrl: estudianteActualizado.fotoUrl,
    });
  } catch (error) {
    console.error("Error al subir imagen a Cloudinary:", error);
    res.status(500).json({ error: "Error al procesar la imagen" });
  }
};

const actualizartutor = async (req, res) => {
  try {
    const idUsuario = req.usuario.id;
    const {
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      telefono,
      parentesco,
      email,
      direccion,
    } = req.body;

    if (!nombre || !apellidoPaterno || !telefono || !parentesco) {
      return res.status(400).json({
        error:
          "Faltan datos obligatorios (Nombre, Apellido, Teléfono, Parentesco).",
      });
    }

    const estudiante = await prisma.estudiante.findUnique({
      where: { usuarioId: idUsuario },
      select: { idEstudiante: true, tutorId: true },
    });

    if (!estudiante) {
      return res.status(404).json({ error: "Estudiante no encontrado." });
    }

    if (estudiante.tutorId !== null) {
      return res.status(403).json({
        error:
          "Ya tienes un tutor registrado. Para realizar cambios, acude a Control Escolar.",
      });
    }

    const estudianteActualizado = await prisma.estudiante.update({
      where: { idEstudiante: estudiante.idEstudiante },
      data: {
        datosVerificados: true,
        tutor: {
          create: {
            nombre,
            apellidoPaterno,
            apellidoMaterno,
            telefono,
            parentesco,
            email: email || null,
            direccion: direccion || null,
          },
        },
      },
      include: { tutor: true },
    });

    res.json({
      mensaje: "Tutor registrado correctamente. Esta acción es permanente.",
      tutor: estudianteActualizado.tutor,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al registrar el tutor." });
  }
};

// Genera firma digital JWT para la credencial
const generarFirmaCredencial = (datosCredencial) => {
  const payload = {
    tipo: "CREDENCIAL_DIGITAL",
    matricula: datosCredencial.noControl,
    curp: datosCredencial.curp,
    nombre: datosCredencial.nombreCompleto,
    especialidad: datosCredencial.especialidad,
    grupo: datosCredencial.grupo,
    turno: datosCredencial.turno,
    emision: datosCredencial.emision,
    vigencia: datosCredencial.vigencia,
    fotoHash: datosCredencial.fotoUrl
      ? require("crypto")
          .createHash("sha256")
          .update(datosCredencial.fotoUrl)
          .digest("hex")
          .substring(0, 16)
      : null,
    firmadoPor:
      datosCredencial.firmante.nombre || datosCredencial.firmante.cargo,
    timestamp: new Date().toISOString(),
  };

  const firma = jwt.sign(payload, getJwtSecret(), {
    expiresIn: "365d", // La firma es válida por 1 año
    algorithm: "HS256",
  });

  return firma;
};

const getCredencial = async (req, res) => {
  try {
    const idUsuario = req.usuario.id;
    const firmante = await obtenerFirmanteCredencial();

    const estudiante = await prisma.estudiante.findUnique({
      where: { usuarioId: idUsuario },
      include: {
        usuario: true,
        grupo: {
          include: {
            especialidad: true,
          },
        },
      },
    });

    if (!estudiante) {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }

    const formatearFechaMesAnio = (fecha) => {
      if (!fecha) return "Por definir";
      const meses = [
        "enero",
        "febrero",
        "marzo",
        "abril",
        "mayo",
        "junio",
        "julio",
        "agosto",
        "septiembre",
        "octubre",
        "noviembre",
        "diciembre",
      ];
      return `${meses[fecha.getMonth()]} ${fecha.getFullYear()}`;
    };

    const fechaEmisionFormateada = formatearFechaMesAnio(
      estudiante.credencialFechaEmision,
    );
    const fechaExpiracionFormateada = formatearFechaMesAnio(
      estudiante.credencialFechaExpiracion,
    );

    const qrPayload = `${estudiante.matricula}|${Date.now()}`;
    const qrBase64 = await QRCode.toDataURL(qrPayload);

    // Armamos el objeto de respuesta de forma segura
    const respuesta = {
      nombreCompleto: `${estudiante.usuario.nombre} ${estudiante.usuario.apellidoPaterno} ${estudiante.usuario.apellidoMaterno}`,
      curp: estudiante.usuario.curp || "Sin CURP",
      noControl: estudiante.matricula || "Sin Matrícula",
      especialidad:
        estudiante.grupo?.especialidad?.nombre || "Sin Especialidad Asignada",
      grupo: estudiante.grupo?.nombre || "Sin Grupo",
      turno: estudiante.grupo?.turno || "Sin Turno",
      emision: fechaEmisionFormateada,
      vigencia: fechaExpiracionFormateada,
      fotoUrl: estudiante.fotoUrl || null,
      qrPayload,
      qrBase64,
      firmante,
      imagenFirmaDirector: firmante.firmaImagenUrl || null,
    };

    // Generar firma digital de la credencial
    const firmaDigital = generarFirmaCredencial(respuesta);
    respuesta.firmaDigital = firmaDigital;

    // Imprimimos en la terminal del backend para verificar que sí manda los datos
    console.log("Datos enviados a la app:", {
      curp: respuesta.curp,
      grupo: respuesta.grupo,
      firmaHashCortada: firmaDigital.substring(0, 20) + "...",
      tieneImagenFirma: !!respuesta.firmante.firmaImagenUrl,
    });

    res.json(respuesta);
  } catch (error) {
    console.error("Error en getCredencial:", error);
    res.status(500).json({ error: "Error al obtener la credencial." });
  }
};

const getHistorialAccesos = async (req, res) => {
  try {
    const idUsuario = req.usuario.id;

    const estudiante = await prisma.estudiante.findUnique({
      where: { usuarioId: idUsuario },
      select: { idEstudiante: true },
    });

    const accesos = await prisma.accesos.findMany({
      where: { alumnoId: estudiante.idEstudiante },
      orderBy: { fechaHora: "desc" },
      take: 20,
    });

    res.json(accesos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener los accesos " });
  }
};

const getAsistencias = async (req, res) => {
  try {
    const idUsuario = req.usuario.id;
    const { periodoId, incluirHistorico } = req.query;

    let periodoFiltro = null;
    if (periodoId) {
      periodoFiltro = parseInt(periodoId);
    } else if (String(incluirHistorico).toLowerCase() !== "true") {
      const periodoActivo = await prisma.periodo.findFirst({
        where: { activo: true },
        select: { idPeriodo: true },
      });
      periodoFiltro = periodoActivo?.idPeriodo || null;
    }

    const estudiante = await prisma.estudiante.findUnique({
      where: { usuarioId: idUsuario },
      select: { idEstudiante: true },
    });

    if (!estudiante) {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }

    const includeAsistencia = {
      clase: {
        include: {
          materias: { select: { nombre: true } },
          docente: {
            include: {
              usuario: { select: { nombre: true, apellidoPaterno: true } },
            },
          },
        },
      },
    };

    const whereBase = { alumnoId: estudiante.idEstudiante };
    const wherePeriodo = periodoFiltro
      ? {
          ...whereBase,
          clase: {
            periodoId: periodoFiltro,
          },
        }
      : whereBase;

    let asistencias = await prisma.asistencia.findMany({
      where: wherePeriodo,
      include: includeAsistencia,
      orderBy: { fecha: "desc" },
    });

    const historialLimpio = asistencias.map((a) => ({
      fecha: a.fecha,
      estatus: a.estatus,
      materia: a.clase?.materias?.nombre || "Materia no asignada",
      docente: a.clase?.docente?.usuario
        ? `${a.clase.docente.usuario.nombre} ${a.clase.docente.usuario.apellidoPaterno}`
        : "Docente no asignado",
    }));

    res.json(historialLimpio);
  } catch (error) {
    console.error("Error al obtener asistencias:", error);
    res.status(500).json({ error: "Error al obtener asistencias" });
  }
};

const getReportesEstudianteMovil = async (req, res) => {
  try {
    const idUsuario = req.usuario.id;
    const estudiante = await prisma.estudiante.findUnique({
      where: { usuarioId: idUsuario },
      select: { idEstudiante: true },
    });

    if (!estudiante) {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }

    const reportes = await prisma.reporte.findMany({
      where: { alumnoId: estudiante.idEstudiante },
      include: {
        docente: {
          include: {
            usuario: { select: { nombre: true, apellidoPaterno: true } },
          },
        },
      },
      orderBy: { fecha: "desc" },
    });

    const reportesLimpios = reportes.map((r) => ({
      id: r.idReporte,
      titulo: r.titulo,
      descripcion: r.descripcion,
      tipo: r.tipoIncidencia,
      gravedad: r.nivel,
      estatus: r.estatus,
      fecha: r.fecha,
      acciones: r.accionesTomadas,
      docente: r.docente
        ? `${r.docente.usuario.nombre} ${r.docente.usuario.apellidoPaterno}`
        : "Administración",
    }));

    res.json(reportesLimpios);
  } catch (error) {
    console.error("Error al obtener reportes móvil:", error);
    res.status(500).json({ error: "Error al obtener los reportes" });
  }
};

const cambiarContrasenia = async (req, res) => {
  try {
    const idUsuario = req.usuario.id;
    const { passwordActual, passwordNueva, passwordConfirmar } = req.body;

    if (!passwordActual || !passwordNueva || !passwordConfirmar) {
      return res.status(400).json({
        error:
          "Debes proporcionar la contraseña actual, la nueva y su confirmación.",
      });
    }

    if (passwordNueva !== passwordConfirmar) {
      return res.status(400).json({
        error: "La nueva contraseña y su confirmación no coinciden.",
      });
    }

    if (passwordNueva.length < 8) {
      return res.status(400).json({
        error: "La nueva contraseña debe tener al menos 8 caracteres.",
      });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { idUsuario },
      select: { password: true },
    });

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }

    const passwordValida = await bcrypt.compare(
      passwordActual,
      usuario.password,
    );

    if (!passwordValida) {
      return res
        .status(401)
        .json({ error: "La contraseña actual es incorrecta." });
    }

    const hashNueva = await bcrypt.hash(passwordNueva, 10);

    await prisma.usuario.update({
      where: { idUsuario },
      data: { password: hashNueva },
    });

    res.json({ mensaje: "Contraseña actualizada correctamente." });
  } catch (error) {
    console.error("Error al cambiar contraseña:", error);
    res.status(500).json({ error: "Error al cambiar la contraseña." });
  }
};

const loginPadrePorAlumno = async (req, res) => {
  try {
    const { matricula, curp } = req.body;

    const matriculaNormalizada = String(matricula || "").trim();
    const curpNormalizada = String(curp || "")
      .trim()
      .toUpperCase();

    if (!matriculaNormalizada || !curpNormalizada) {
      return res
        .status(400)
        .json({ error: "Debes enviar matrícula y CURP del alumno" });
    }

    const estudiante = await prisma.estudiante.findFirst({
      where: {
        matricula: matriculaNormalizada,
        usuario: {
          curp: curpNormalizada,
          activo: true,
        },
      },
      include: {
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
            grado: true,
            turno: true,
          },
        },
      },
    });

    if (!estudiante) {
      return res.status(401).json({ error: "Datos de acceso inválidos" });
    }

    const tokenPadre = jwt.sign(
      {
        tipoAcceso: "PADRE",
        alumnoId: estudiante.idEstudiante,
      },
      getJwtSecret(),
      { expiresIn: "2h" },
    );

    return res.json({
      ok: true,
      mensaje: "Acceso de padre autorizado",
      token: tokenPadre,
      alumno: {
        idEstudiante: estudiante.idEstudiante,
        nombreCompleto:
          `${estudiante.usuario.nombre} ${estudiante.usuario.apellidoPaterno} ${estudiante.usuario.apellidoMaterno || ""}`.trim(),
        matricula: estudiante.matricula,
        grupo: estudiante.grupo,
      },
    });
  } catch (error) {
    console.error("Error en login de padre:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
};

const getResumenAlumnoPadre = async (req, res) => {
  try {
    const alumnoId = req.usuario.alumnoId;

    const estudiante = await prisma.estudiante.findUnique({
      where: { idEstudiante: parseInt(alumnoId, 10) },
      include: {
        usuario: {
          select: {
            nombre: true,
            apellidoPaterno: true,
            apellidoMaterno: true,
            curp: true,
          },
        },
        grupo: {
          include: {
            especialidad: {
              select: { nombre: true },
            },
          },
        },
      },
    });

    if (!estudiante) {
      return res.status(404).json({ error: "Alumno no encontrado" });
    }

    return res.json({
      idEstudiante: estudiante.idEstudiante,
      matricula: estudiante.matricula,
      nombreCompleto:
        `${estudiante.usuario.nombre} ${estudiante.usuario.apellidoPaterno} ${estudiante.usuario.apellidoMaterno || ""}`.trim(),
      curp: estudiante.usuario.curp,
      grupo: estudiante.grupo,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "Error al obtener resumen del alumno" });
  }
};

const getAsistenciasPadre = async (req, res) => {
  try {
    const alumnoId = req.usuario.alumnoId;
    const { fechaInicio, fechaFin } = req.query;

    const where = {
      alumnoId: parseInt(alumnoId, 10),
    };

    if (fechaInicio || fechaFin) {
      where.fecha = {};
      if (fechaInicio) {
        const inicio = new Date(fechaInicio);
        inicio.setHours(0, 0, 0, 0);
        where.fecha.gte = inicio;
      }
      if (fechaFin) {
        const fin = new Date(fechaFin);
        fin.setHours(23, 59, 59, 999);
        where.fecha.lte = fin;
      }
    }

    const asistencias = await prisma.asistencia.findMany({
      where,
      include: {
        clase: {
          include: {
            materias: {
              select: { nombre: true },
            },
          },
        },
      },
      orderBy: { fecha: "desc" },
    });

    return res.json(
      asistencias.map((a) => ({
        idAsistencia: a.idAsistencia,
        fecha: a.fecha,
        estatus: a.estatus,
        materia: a.clase?.materias?.nombre || "Sin materia",
      })),
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al obtener asistencias" });
  }
};

const getReportesPadre = async (req, res) => {
  try {
    const alumnoId = req.usuario.alumnoId;

    const reportes = await prisma.reporte.findMany({
      where: {
        alumnoId: parseInt(alumnoId, 10),
      },
      include: {
        docente: {
          include: {
            usuario: {
              select: {
                nombre: true,
                apellidoPaterno: true,
              },
            },
          },
        },
      },
      orderBy: { fecha: "desc" },
    });

    return res.json(
      reportes.map((r) => ({
        idReporte: r.idReporte,
        titulo: r.titulo,
        descripcion: r.descripcion,
        tipoIncidencia: r.tipoIncidencia,
        nivel: r.nivel,
        estatus: r.estatus,
        fecha: r.fecha,
        accionesTomadas: r.accionesTomadas,
        docente: r.docente
          ? `${r.docente.usuario.nombre} ${r.docente.usuario.apellidoPaterno}`
          : "Administración",
      })),
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al obtener reportes" });
  }
};

// Endpoint para verificar la firma digital de una credencial
const verificarFirmaCredencial = async (req, res) => {
  try {
    const { firmaDigital } = req.body;

    if (!firmaDigital) {
      return res.status(400).json({ error: "La firma digital es requerida" });
    }

    // Verificar la firma
    let datosDecodificados;
    try {
      datosDecodificados = jwt.verify(firmaDigital, getJwtSecret(), {
        algorithms: ["HS256"],
      });
    } catch (err) {
      return res.status(401).json({
        ok: false,
        valida: false,
        error: "Firma inválida o expirada",
        detalleError: err.message,
      });
    }

    // Validar que sea una credencial digital
    if (datosDecodificados.tipo !== "CREDENCIAL_DIGITAL") {
      return res.status(400).json({
        ok: false,
        valida: false,
        error: "La firma no corresponde a una credencial digital",
      });
    }

    return res.json({
      ok: true,
      valida: true,
      mensaje: "Firma válida y no alterada",
      credencial: {
        matricula: datosDecodificados.matricula,
        nombre: datosDecodificados.nombre,
        curp: datosDecodificados.curp,
        especialidad: datosDecodificados.especialidad,
        grupo: datosDecodificados.grupo,
        turno: datosDecodificados.turno,
        emision: datosDecodificados.emision,
        vigencia: datosDecodificados.vigencia,
        firmadoPor: datosDecodificados.firmadoPor,
      },
    });
  } catch (error) {
    console.error("Error al verificar firma:", error);
    res.status(500).json({ error: "Error al verificar la firma" });
  }
};

module.exports = {
  getAlumnosMovil,
  uploadFotiko,
  actualizartutor,
  getCredencial,
  guardarDisenioCredencialMovil,
  getAsistencias,
  getHistorialAccesos,
  getReportesEstudianteMovil,
  cambiarContrasenia,
  loginPadrePorAlumno,
  getResumenAlumnoPadre,
  getAsistenciasPadre,
  getReportesPadre,
  verificarFirmaCredencial,
  actualizarDatosContacto,
};
