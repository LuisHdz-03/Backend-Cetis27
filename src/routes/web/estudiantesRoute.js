const { Router } = require("express");
const router = Router();
const {
  uploadExcelSingle,
} = require("../../middlewares/excelUploadMiddleware");

const {
  adminODirectivo,
  verificarRol,
} = require("../../middlewares/authMiddleware");
const {
  bitacoraCrear,
  bitacoraActualizar,
  bitacoraEliminar,
  bitacoraConsultar,
  bitacoraCargaMasiva,
} = require("../../middlewares/bitacoraMiddleware");

const {
  crearEstudiante,
  getEstudiantes,
  cargarDatosMasivos,
  actualizarEstudiante,
  eliminarEstudiante,
  getEstudiantesPorGrupo,
  descargarPlantillaEstudiantes,
} = require("../../controller/web/estudianteController");

// Obtener datos para credenciales (para frontend)
router.get(
  "/credenciales",
  adminODirectivo,
  bitacoraConsultar,
  require("../../controller/web/estudianteController").getDatosCredenciales,
);

// ...existing code...
router.post("/", adminODirectivo, bitacoraCrear, crearEstudiante);
router.get(
  "/",
  verificarRol("ADMINISTRATIVO", "DIRECTIVO", "PREFECTO"),
  bitacoraConsultar,
  getEstudiantes,
);
router.post(
  "/masivo",
  adminODirectivo,
  uploadExcelSingle("archivoExcel"),
  bitacoraCargaMasiva,
  cargarDatosMasivos,
);
router.put("/:id", adminODirectivo, bitacoraActualizar, actualizarEstudiante);
router.delete("/:id", adminODirectivo, bitacoraEliminar, eliminarEstudiante);
router.get(
  "/grupo/:grupoId",
  (req, res, next) => {
    // Permitir acceso a ADMINISTRATIVO, DIRECTIVO o DOCENTE
    const rol = req.usuario?.rol?.toUpperCase();
    if (["ADMINISTRATIVO", "DIRECTIVO", "DOCENTE"].includes(rol)) {
      return next();
    }
    return res
      .status(403)
      .json({ error: "No tienes permisos suficientes para ver este grupo." });
  },
  bitacoraConsultar,
  getEstudiantesPorGrupo,
);
router.get(
  "/plantilla/excel",
  adminODirectivo,
  bitacoraConsultar,
  descargarPlantillaEstudiantes,
);

module.exports = router;
