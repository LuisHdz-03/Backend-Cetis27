const prisma = require("../../config/prisma");
const jwt = require("jsonwebtoken");

const loginPadre = async (req, res) => {
  try {
    const { clave } = req.body;

    if (!clave) {
      return res
        .status(400)
        .json({ error: "La clave del alumno es obligatoria." });
    }

    const estudiante = await prisma.estudiante.findFirst({
      where: { tokenPadre: clave },
      include: {
        usuario: true,
        grupo: { include: { especialidad: true } },
      },
    });

    if (!estudiante) {
      return res
        .status(404)
        .json({ error: "Clave incorrecta o alumno no encontrado." });
    }

    const token = jwt.sign(
      {
        idEstudiante: estudiante.idEstudiante,
        rol: "PADRE",
      },
      process.env.JWT_SECRET || "secreto_temporal",
      { expiresIn: "30d" },
    );

    res.json({
      mensaje: "Bienvenido al portal de padres",
      token,
      alumno: {
        id: estudiante.idEstudiante,
        nombre: `${estudiante.usuario.nombre} ${estudiante.usuario.apellidoPaterno}`,
        grupo: `${estudiante.grupo.grado}º ${estudiante.grupo.nombre} - ${estudiante.grupo.especialidad.nombre}`,
      },
    });
  } catch (error) {
    console.error("Error en loginPadre:", error);
    res.status(500).json({ error: "Error en el servidor." });
  }
};

// Obtener solo el grupo del estudiante por id
const grupoEstudiante = async (req, res) => {
  const { idEstudiante } = req.params;
  try {
    const estudiante = await prisma.estudiante.findUnique({
      where: { idEstudiante: Number(idEstudiante) },
      include: {
        grupo: { include: { especialidad: true } },
        usuario: {
          select: {
            nombre: true,
            apellidoPaterno: true,
            apellidoMaterno: true,
          },
        },
      },
    });
    if (!estudiante || !estudiante.grupo) {
      return res
        .status(404)
        .json({ error: "Estudiante o grupo no encontrado" });
    }
    res.json({
      idEstudiante: estudiante.idEstudiante,
      nombre:
        `${estudiante.usuario.nombre} ${estudiante.usuario.apellidoPaterno} ${estudiante.usuario.apellidoMaterno || ""}`.trim(),
      grupo: {
        idGrupo: estudiante.grupo.idGrupo,
        nombre: estudiante.grupo.nombre,
        grado: estudiante.grupo.grado,
        especialidad: estudiante.grupo.especialidad?.nombre || null,
      },
    });
  } catch (error) {
    console.error("Error al consultar grupo del estudiante:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

module.exports = { loginPadre, grupoEstudiante };
