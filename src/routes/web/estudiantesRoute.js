const { Router } = require("express");
const router = Router();
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const { verificarToken, adminODirectivo } = require("../../middlewares/authMiddleware");
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

// Aplicar verificarToken y bitácora a todas las rutas
router.post("/", verificarToken, adminODirectivo, bitacoraCrear, crearEstudiante);
router.get("/", verificarToken, adminODirectivo, bitacoraConsultar, getEstudiantes);
router.post(
  "/masivo",
  verificarToken,
  adminODirectivo,
  upload.single("archivoExcel"),
  bitacoraCargaMasiva,
  cargarDatosMasivos,
);
router.put("/:id", verificarToken, adminODirectivo, bitacoraActualizar, actualizarEstudiante);
router.delete("/:id", verificarToken, adminODirectivo, bitacoraEliminar, eliminarEstudiante);
router.get(
  "/grupo/:grupoId",
  verificarToken,
  adminODirectivo,
  bitacoraConsultar,
  getEstudiantesPorGrupo,
);
router.get(
  "/plantilla/excel",
  verificarToken,
  adminODirectivo,
  bitacoraConsultar,
  descargarPlantillaEstudiantes,
);

module.exports = router;
