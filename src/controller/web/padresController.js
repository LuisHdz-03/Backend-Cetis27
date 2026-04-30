const prisma = require("../../config/prisma");
const jwt = require("jsonwebtoken");

const loginPadre = async (req, res) => {
  try {
    const { clave } = req.body;

    if (!clave) {
      return res.status(400).json({ error: "La clave del alumno es obligatoria." });
    }

    const estudiante = await prisma.estudiante.findFirst({
      where: { tokenPadre: clave },
      include: {
        usuario: true,
        grupo: { include: { especialidad: true } }
      }
    });

    if (!estudiante) {
      return res.status(404).json({ error: "Clave incorrecta o alumno no encontrado." });
    }

    const token = jwt.sign(
      {
        idEstudiante: estudiante.idEstudiante,
        rol: "PADRE"
      },
      process.env.JWT_SECRET || "secreto_temporal",
      { expiresIn: "30d" } 
    );

    res.json({
      mensaje: "Bienvenido al portal de padres",
      token,
      alumno: {
        id: estudiante.idEstudiante,
        nombre: `${estudiante.usuario.nombre} ${estudiante.usuario.apellidoPaterno}`,
        grupo: `${estudiante.grupo.grado}º ${estudiante.grupo.nombre} - ${estudiante.grupo.especialidad.nombre}`
      }
    });
  } catch (error) {
    console.error("Error en loginPadre:", error);
    res.status(500).json({ error: "Error en el servidor." });
  }
};

module.exports = { loginPadre };