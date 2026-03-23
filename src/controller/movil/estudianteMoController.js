const prisma = require("../../config/prisma");
const path = require("path");
const sharp = require("sharp");
const fs = require("fs");
const QRCode = require("qrcode");
const cloudinary = require("cloudinary").v2;

//configuracion del coudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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
          },
        },
        grupo: {
          select: {
            nombre: true,
            grado: true,
            turno: true,
            especialidad: { select: { nombre: true } },
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

const getCredencial = async (req, res) => {
  try {
    const idUsuario = req.usuario.id;

    // Usamos include para todo, es mucho más seguro en Prisma
    const estudiante = await prisma.estudiante.findUnique({
      where: { usuarioId: idUsuario },
      include: {
        usuario: true, // Traemos todo el usuario (incluye la CURP)
        grupo: {
          include: {
            especialidad: true, // Traemos la especialidad del grupo
          },
        },
      },
    });

    if (!estudiante) {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }

    const tiempoActual = Date.now();
    const datosQR = `${estudiante.matricula}|${tiempoActual}`;
    const qrImage = await QRCode.toDataURL(datosQR);

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
      qrImage: qrImage,
      fotoUrl: estudiante.fotoUrl || null,
    };

    // Imprimimos en la terminal del backend para verificar que sí manda los datos
    console.log("Datos enviados a la app:", {
      curp: respuesta.curp,
      grupo: respuesta.grupo,
    });

    res.json(respuesta);
  } catch (error) {
    console.error("Error en getCredencial:", error);
    res.status(500).json({ error: "Error al generar la credencial." });
  }
};
const getHistorialAccesos = async (req, res) => {
  try {
    const idUsuario = req.usuario.id;

    const estudiante = await prisma.estudiante.findUnique({
      where: { usuarioId: idUsuario },
      select: { idEstudiante: true },
    });

    const accesos = await prisma.aceesos.findMany({
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

    // 1. Buscamos al estudiante asociado al usuario del token
    const estudiante = await prisma.estudiante.findUnique({
      where: { usuarioId: idUsuario },
      select: { idEstudiante: true },
    });

    if (!estudiante) {
      return res
        .status(404)
        .json({ error: "Perfil de estudiante no encontrado" });
    }

    // 2. Consultamos las asistencias usando las relaciones del schema
    const asistencias = await prisma.asistencia.findMany({
      where: { alumnoId: estudiante.idEstudiante },
      include: {
        clase: {
          include: {
            materias: {
              select: { nombre: true },
            },
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
      orderBy: { fecha: "desc" },
      take: 50, // Limitamos a las últimas 50 para mejor rendimiento
    });

    // 3. Mapeamos al formato que espera la App móvil
    const historialLimpio = asistencias.map((a) => ({
      fecha: a.fecha,
      estatus: a.estatus, // En tu schema se llama 'estatus'
      materia: a.clase?.materias?.nombre || "Materia no asignada",
      docente: a.clase?.docente?.usuario
        ? `${a.clase.docente.usuario.nombre} ${a.clase.docente.usuario.apellidoPaterno}`
        : "Docente no asignado",
    }));

    res.json(historialLimpio);
  } catch (error) {
    console.error("Error detallado en getAsistencias:", error);
    res.status(500).json({ error: "Error interno al obtener las asistencias" });
  }
};

const getReportesEstudianteMovil = async (req, res) => {
  try {
    const idUsuario = req.usuario.id; // Obtenido del token verificado

    // 1. Buscamos el ID del estudiante asociado al usuario
    const estudiante = await prisma.estudiante.findUnique({
      where: { usuarioId: idUsuario },
      select: { idEstudiante: true },
    });

    if (!estudiante) {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }

    // 2. Traemos sus reportes con la info del docente que reportó
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

    // 3. Limpiamos los datos para que la app móvil los reciba fácil
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

module.exports = {
  getAlumnosMovil,
  uploadFotiko,
  actualizartutor,
  getCredencial,
  getAsistencias,
  getHistorialAccesos,
  getReportesEstudianteMovil,
};
