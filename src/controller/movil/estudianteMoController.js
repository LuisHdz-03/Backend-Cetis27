const { PrismaClient } = require("@prisma/client");
const path = require("path");
const sharp = require("sharp");
const fs = require("fs");
const QRCode = require("qrcode");
const prisma = new PrismaClient();

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
          },
        },
        grupo: { select: { nombre: true } },
      },
    });

    if (!estudiante)
      return res.status(404).json({ error: "estudiante no econtrado" });

    const datosQr = JSON.stringify({
      matricula: estudiante.matricula,
      nombre: `${estudiante.usuario.nombre} ${estudiante.usuario.apellidoPaterno} ${estudiante.usuario.apellidoMaterno}`,
      grupo: estudiante.grupo?.nombre,
      tipo: "ALUMNO",
      validado: true,
    });

    const imgQr = await QRCode.toDataURL(datosQr);

    res.json({
      matricula: estudiante.matricula,
      grupo: estudiante.grupo?.nombre,
      imagenQr: imgQr,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al generar la credencial" });
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
    const estudiante = await prisma.estudiante.findUnique({
      where: { usuarioId: idUsuario },
      select: { idEstudiante: true },
    });

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
                usuario: { select: { nombre: true, apellidoPaterno: true } },
              },
            },
          },
        },
      },
      orderBy: { fecha: "desc" },
      take: 50,
    });

    const historialLimpio = asistencias.map((a) => ({
      fecha: a.fecha,
      estado: a.estado,
      materia: a.clase.materias.nombre,
      docente: `${a.clase.docente.usuario.nombre} ${a.clase.docente.usuario.apellidoPaterno}`,
    }));
    res.json(historialLimpio);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener las asistencias" });
  }
};
module.exports = {
  getAlumnosMovil,
  uploadFotiko,
  actualizartutor,
  getCredencial,
  getAsistencias,
  getHistorialAccesos,
};
