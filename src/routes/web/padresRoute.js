const { Router } = require("express");
const router = Router();

const { verificarTokenPadre } = require("../../middlewares/authMiddleware");
const {
  parentAccessLimiter,
} = require("../../middlewares/rateLimitMiddleware");

const {
  loginPadrePorAlumno,
  getResumenAlumnoPadre,
  getAsistenciasPadre,
  getReportesPadre,
} = require("../../controller/movil/estudianteMoController");

router.post("/login", parentAccessLimiter, loginPadrePorAlumno);
router.get("/alumno", verificarTokenPadre, getResumenAlumnoPadre);
router.get("/asistencias", verificarTokenPadre, getAsistenciasPadre);
router.get("/reportes", verificarTokenPadre, getReportesPadre);

module.exports = router;
