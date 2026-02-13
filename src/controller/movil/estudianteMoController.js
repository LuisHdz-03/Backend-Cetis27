const { PrismaClient } = require("@prisma/client");
const path = require("path");
const sharp = require("sharp");
const fs = require("fs");
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
          },
        },
        tutor: {
          select: {
            nombre: true,
            apellidoPaterno: true,
            telefono: true,
            parentesco: true,
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
    const nombreAcrchivo = `perfil-${idUsuario}-${Date.now()}.jpeg`;
    const carpetaUploads = path.join(__dirname, "../../../public/uploads");
    const rutasCompletas = path.join(carpetaUploads, nombreAcrchivo);

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

    const nuevaFtUrl = `/uploads/${nombreAcrchivo}`;

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
      if (fs.existsSync(pathViejo)) {
        try {
          fs.unlinkSync(pathViejo);
          console.log(`Foto eliminada: ${pathViejo}`);
        } catch (e) {
          console.error("Error al borrar foto vieja:", e);
        }
      }
    }
    const estudianteActualizado = await prisma.estudiante.update({
      where: { usuarioId: idUsuario },
      data: { fotoUrl: nuevaFtUrl },
    });

    res.json({
      mensjae: "Foto actualizada correctamente",
      fotoUrl: estudianteActualizado.fotoUrl,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al procesar la imagen" });
  }
};

const actualizartutor = async (req,res)=>{
  
}

module.exports = { getAlumnosMovil, uploadFotiko };
