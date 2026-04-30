const { Router } = require("express");
const router = Router();

const {
  parentAccessLimiter,
} = require("../../middlewares/rateLimitMiddleware");
const {
  loginPadrePorAlumno,
} = require("../../controller/movil/estudianteMoController");
const {
  consultarEstatusCompletoEstudiante,
  loginPadrePorToken,
} = require("../../controller/movil/estatusEstudianteController");
const { loginPadre } = require("../../controller/web/padresController");

router.post("/login-token", loginPadrePorToken);

router.get(
  "/estatus-completo/:idEstudiante",
  consultarEstatusCompletoEstudiante,
);

router.post("/login", loginPadre);

module.exports = router;
module.exports = router;
