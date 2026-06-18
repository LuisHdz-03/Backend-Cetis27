const { Router } = require("express");
const router = Router();
const { uploadExcelSingle } = require("../../middlewares/excelUploadMiddleware");

const {
  registrarAsistencia,
  getAsisPorFecha,
  justificarFalta,
  getHistorialAsistencias,
  exportarHistorialAsistenciasExcel,
  descargarPlantillaAsistencias,
  cargarAsistenciasMasivas,
} = require("../../controller/web/asistenciaController");

const { verificarRol } = require("../../middlewares/authMiddleware");
const {
  bitacoraCrear,
  bitacoraActualizar,
  bitacoraConsultar,
  bitacoraCargaMasiva,
} = require("../../middlewares/bitacoraMiddleware");

router.post(
  "/",
  verificarRol("ADMINISTRATIVO", "DIRECTIVO", "PREFECTO", "DOCENTE"),
  bitacoraCrear,
  registrarAsistencia,
);
router.get(
  "/",
  verificarRol("ADMINISTRATIVO", "DIRECTIVO", "PREFECTO", "DOCENTE"),
  bitacoraConsultar,
  getAsisPorFecha,
);
router.put(
  "/:idAsistencia",
  verificarRol("ADMINISTRATIVO", "DIRECTIVO", "PREFECTO"),
  bitacoraActualizar,
  justificarFalta,
);
router.get(
  "/historial",
  verificarRol("ADMINISTRATIVO", "DIRECTIVO", "PREFECTO", "DOCENTE"),
  bitacoraConsultar,
  getHistorialAsistencias,
);
router.get(
  "/historial/excel",
  verificarRol("ADMINISTRATIVO", "DIRECTIVO", "PREFECTO", "DOCENTE"),
  bitacoraConsultar,
  exportarHistorialAsistenciasExcel,
);
router.get(
  "/plantilla/excel",
  verificarRol("ADMINISTRATIVO", "DIRECTIVO", "PREFECTO", "DOCENTE"),
  bitacoraConsultar,
  descargarPlantillaAsistencias,
);
router.post(
  "/masivo",
  verificarRol("ADMINISTRATIVO", "DIRECTIVO", "PREFECTO", "DOCENTE"),
  uploadExcelSingle("archivoExcel"),
  bitacoraCargaMasiva,
  cargarAsistenciasMasivas,
);

module.exports = router;
