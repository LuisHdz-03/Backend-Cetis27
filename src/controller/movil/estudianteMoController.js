const prisma = require("../../config/prisma");
const path = require("path");
const sharp = require("sharp");
const fs = require("fs");
const QRCode = require("qrcode");

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
      return res.status(400).json({ mensaje: "no se encontro ninguna imagen" });
    }

    const idUsuario = req.usuario.id;
    const nombreArchivo = `perfil-${idUsuario}-${Date.now()}.jpeg`;
    const carpetaUploads = path.join(__dirname, "../../../public/uploads");
    const rutasCompletas = path.join(carpetaUploads, nombreArchivo);

    if (!fs.existsSync(carpetaUploads)) {
      fs.mkdirSync(carpetaUploads, { recursive: true });
    }

    await sharp(req.file.buffer)
      .resize(500, 500, {
        fit: "cover",
        position: "attention",
      })
      .jpeg({ quality: 80 })
      .toFile(rutasCompletas);

    const nuevaFtUrl = `/uploads/${nombreArchivo}`;

    const estudiantePrevio = await prisma.estudiante.findUnique({
      where: {
        usuarioId: idUsuario,
      },
      select: { fotoUrl: true },
    });

    if (estudiantePrevio?.fotoUrl) {
      const nombreViejo = estudiantePrevio.fotoUrl.startsWith("/")
        ? estudiantePrevio.fotoUrl.substring(1)
        : estudiantePrevio.fotoUrl;

      const pathViejo = path.join(__dirname, "../../../public", nombreViejo);

      try {
        fs.unlinkSync(pathViejo);
        console.log(`Foto eliminada: ${pathViejo}`);
      } catch (e) {
        if (e.code !== "ENOENT")
          console.error("Error al borrar foto vieja:", e);
      }
    }
    const estudianteActualizado = await prisma.estudiante.update({
      where: { usuarioId: idUsuario },
      data: { fotoUrl: nuevaFtUrl },
    });

    res.json({
      mensaje: "Foto actualizada correctamente",
      fotoUrl: estudianteActualizado.fotoUrl,
    });
  } catch (error) {
    console.error(error);
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

    const estudiante = await prisma.estudiante.findUnique({
      where: { usuarioId: idUsuario },
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
          select: {
            nombre: true, 
            turno: true,
            especialidad: { select: { nombre: true } },
          },
        },
      },
    });

    if (!estudiante)
      return res.status(404).json({ error: "Estudiante no encontrado" });

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

    res.json({
      nombreCompleto: `${estudiante.usuario.nombre} ${estudiante.usuario.apellidoPaterno} ${estudiante.usuario.apellidoMaterno}`,
      // ¡CORRECCIÓN 2: La CURP viene de 'usuario', no de 'estudiante' directo!
      curp: estudiante.usuario.curp,
      noControl: estudiante.matricula,
      especialidad:
        estudiante.grupo?.especialidad?.nombre || "Sin Especialidad Asignada",
      // ¡CORRECCIÓN 3: Agregamos el grupo al envío!
      grupo: estudiante.grupo?.nombre || "Sin Grupo",
      turno: estudiante.grupo?.turno || "Sin Turno",
      emision: fechaEmisionFormateada,
      vigencia: fechaExpiracionFormateada,
      qrImage: qrImage,
    });
  } catch (error) {
    console.error(error);
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
