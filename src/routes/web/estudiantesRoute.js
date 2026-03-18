const { Router } = require("express");
const router = Router();
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const { verificarToken } = require("../../middlewares/authMiddleware");
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
} = require("../../controller/web/estudianteController");

// Aplicar verificarToken y bitácora a todas las rutas
router.post("/", verificarToken, bitacoraCrear, crearEstudiante);
router.get("/", verificarToken, bitacoraConsultar, getEstudiantes);
router.post(
  "/masivo",
  verificarToken,
  upload.single("archivoExcel"),
  bitacoraCargaMasiva,
  cargarDatosMasivos,
);
router.put("/:id", verificarToken, bitacoraActualizar, actualizarEstudiante);
router.delete("/:id", verificarToken, bitacoraEliminar, eliminarEstudiante);
router.get(
  "/grupo/:grupoId",
  verificarToken,
  bitacoraConsultar,
  getEstudiantesPorGrupo,
);

module.exports = router;
