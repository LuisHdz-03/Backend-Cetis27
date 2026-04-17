const { Router } = require("express");
const router = Router();
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const { adminODirectivo } = require("../../middlewares/authMiddleware");
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

// ...existing code...
router.post("/", adminODirectivo, bitacoraCrear, crearEstudiante);
router.get("/", adminODirectivo, bitacoraConsultar, getEstudiantes);
router.post(
  "/masivo",
  adminODirectivo,
  upload.single("archivoExcel"),
  bitacoraCargaMasiva,
  cargarDatosMasivos,
);
router.put("/:id", adminODirectivo, bitacoraActualizar, actualizarEstudiante);
router.delete("/:id", adminODirectivo, bitacoraEliminar, eliminarEstudiante);
router.get(
  "/grupo/:grupoId",
  adminODirectivo,
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
