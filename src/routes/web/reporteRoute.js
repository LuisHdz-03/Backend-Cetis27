const { Router } = require("express");
const router = Router();

const {
  crearReporte,
  getReporte,
  atenderReporte,
  getHistorialAlumno,
  getDocentesParaReporte,
} = require("../../controller/web/incidenciasController");

const { verificarToken, verificarRol } = require("../../middlewares/authMiddleware");
const {
  bitacoraCrear,
  bitacoraConsultar,
  bitacoraActualizar,
} = require("../../middlewares/bitacoraMiddleware");

router.post(
  "/",
  verificarToken,
  verificarRol("DOCENTE", "PREFECTO", "ADMINISTRATIVO", "DIRECTIVO"),
  bitacoraCrear,
  crearReporte,
);
router.get(
  "/",
  verificarToken,
  verificarRol("DOCENTE", "PREFECTO", "ADMINISTRATIVO", "DIRECTIVO"),
  bitacoraConsultar,
  getReporte,
);
router.get(
  "/catalogo/docentes",
  verificarToken,
  verificarRol("DOCENTE", "PREFECTO", "ADMINISTRATIVO", "DIRECTIVO"),
  bitacoraConsultar,
  getDocentesParaReporte,
);
router.put(
  "/:reporteId",
  verificarToken,
  verificarRol("PREFECTO", "ADMINISTRATIVO", "DIRECTIVO"),
  bitacoraActualizar,
  atenderReporte,
);
router.get(
  "/alumno/:alumnoId",
  verificarToken,
  verificarRol("DOCENTE", "PREFECTO", "ADMINISTRATIVO", "DIRECTIVO"),
  bitacoraConsultar,
  getHistorialAlumno,
);

module.exports = router;
