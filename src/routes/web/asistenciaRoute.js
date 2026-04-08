const { Router } = require("express");
const router = Router();
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const {
  registrarAsistencia,
  getAsisPorFecha,
  justificarFalta,
  getHistorialAsistencias,
  exportarHistorialAsistenciasExcel,
  descargarPlantillaAsistencias,
  cargarAsistenciasMasivas,
} = require("../../controller/web/asistenciaController");

const { verificarToken, verificarRol } = require("../../middlewares/authMiddleware");
const {
  bitacoraCrear,
  bitacoraActualizar,
  bitacoraConsultar,
  bitacoraCargaMasiva,
} = require("../../middlewares/bitacoraMiddleware");

router.post(
  "/",
  verificarToken,
  verificarRol("ADMINISTRATIVO", "DIRECTIVO", "PREFECTO"),
  bitacoraCrear,
  registrarAsistencia,
);
router.get(
  "/",
  verificarToken,
  verificarRol("ADMINISTRATIVO", "DIRECTIVO", "PREFECTO", "DOCENTE"),
  bitacoraConsultar,
  getAsisPorFecha,
);
router.put(
  "/:idAsistencia",
  verificarToken,
  verificarRol("ADMINISTRATIVO", "DIRECTIVO", "PREFECTO"),
  bitacoraActualizar,
  justificarFalta,
);
router.get(
  "/historial",
  verificarToken,
  verificarRol("ADMINISTRATIVO", "DIRECTIVO", "PREFECTO", "DOCENTE"),
  bitacoraConsultar,
  getHistorialAsistencias,
);
router.get(
  "/historial/excel",
  verificarToken,
  verificarRol("ADMINISTRATIVO", "DIRECTIVO", "PREFECTO"),
  bitacoraConsultar,
  exportarHistorialAsistenciasExcel,
);
router.get(
  "/plantilla/excel",
  verificarToken,
  verificarRol("ADMINISTRATIVO", "DIRECTIVO", "PREFECTO"),
  bitacoraConsultar,
  descargarPlantillaAsistencias,
);
router.post(
  "/masivo",
  verificarToken,
  verificarRol("ADMINISTRATIVO", "DIRECTIVO", "PREFECTO"),
  upload.single("archivoExcel"),
  bitacoraCargaMasiva,
  cargarAsistenciasMasivas,
);

module.exports = router;
