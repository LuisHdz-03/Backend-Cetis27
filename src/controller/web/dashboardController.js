const prisma = require("../../config/prisma");

const getDashboardStats = async (req, res) => {
  try {
    const [alumnos, docentes, materias, administrativos] = await Promise.all([
      prisma.estudiante.count(),
      prisma.docente.count(),
      prisma.materia.count(),
      prisma.administrativo.count(),
    ]);

    res.status(200).json({
      alumnos,
      docentes,
      materias,
      administrativos,
    });
  } catch (error) {
    console.error("Error al obtener estadísticas:", error);

    res.status(500).json({
      error: "Error al obtener las estadísticas del dashboard",
    });
  }
};

module.exports = {
  getDashboardStats,
};
