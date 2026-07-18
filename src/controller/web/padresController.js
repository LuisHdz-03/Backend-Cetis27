const prisma = require("../../config/prisma");
const jwt = require("jsonwebtoken");

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET no está configurada en variables de entorno");
  }
  return process.env.JWT_SECRET;
};

const validarAccesoPadreAEstudiante = (req, idEstudiante) => {
  return (
    req.usuario?.rol === "PADRE" && req.usuario?.idEstudiante === idEstudiante
  );
};

const loginPadre = async (req, res) => {
  try {
    const clave = String(
      req.body?.clave || req.body?.token || req.body?.tokenPadre || "",
    ).trim();

    if (!clave) {
      return res
        .status(400)
        .json({ error: "La clave/token del alumno es obligatoria." });
    }

    // Usamos select/include para traer solo lo necesario
    const estudiante = await prisma.estudiante.findFirst({
      where: { tokenPadre: clave },
      select: {
        idEstudiante: true,
        usuario: { select: { nombre: true, apellidoPaterno: true } },
        grupo: {
          select: {
            grado: true,
            nombre: true,
            especialidad: { select: { nombre: true } },
          },
        },
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
      getJwtSecret(),
      { expiresIn: "30d" },
    );

    res.json({
      mensaje: "Bienvenido al portal de padres",
      token,
      alumno: {
        id: estudiante.idEstudiante,
        nombre: `${estudiante.usuario.nombre} ${estudiante.usuario.apellidoPaterno}`,
        grupo: `${estudiante.grupo.grado}º ${estudiante.grupo.nombre} - ${estudiante.grupo.especialidad?.nombre || "Sin Especialidad"}`,
      },
    });
  } catch (error) {
    console.error("Error en loginPadre:", error);
    res.status(500).json({ error: "Error en el servidor." });
  }
};

const grupoEstudiante = async (req, res) => {
  const { idEstudiante } = req.params;
  const idNum = parseInt(idEstudiante, 10);

  if (isNaN(idNum)) return res.status(400).json({ error: "ID inválido" });

  if (!validarAccesoPadreAEstudiante(req, idNum)) {
    return res.status(403).json({
      error:
        "No tienes permisos para consultar información de otro estudiante.",
    });
  }

  try {
    const estudiante = await prisma.estudiante.findUnique({
      where: { idEstudiante: idNum },
      select: {
        idEstudiante: true,
        usuario: {
          select: {
            nombre: true,
            apellidoPaterno: true,
            apellidoMaterno: true,
          },
        },
        grupo: {
          select: {
            idGrupo: true,
            nombre: true,
            grado: true,
            especialidad: { select: { nombre: true } },
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
    console.error("Error en grupoEstudiante:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

module.exports = { loginPadre, grupoEstudiante };
