const { Router } = require("express");
const router = Router();

const { verificarTokenPadre } = require("../../middlewares/authMiddleware");

const {
  parentAccessLimiter,
} = require("../../middlewares/rateLimitMiddleware");
const {
  loginPadrePorAlumno,
} = require("../../controller/movil/estudianteMoController");
const {
  consultarEstatusCompletoEstudiante,
} = require("../../controller/movil/estatusEstudianteController");
const {
  loginPadre,
  grupoEstudiante,
} = require("../../controller/web/padresController");

router.get(
  "/estatus-completo/:idEstudiante",
  verificarTokenPadre,
  consultarEstatusCompletoEstudiante,
);

router.post("/login", loginPadre);

// Ruta para consultar solo el grupo del estudiante
router.get("/grupo/:idEstudiante", verificarTokenPadre, grupoEstudiante);

module.exports = router;
