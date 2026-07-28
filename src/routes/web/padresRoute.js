const { Router } = require("express");
const router = Router();

const { verificarTokenPadre } = require("../../middlewares/authMiddleware");

const {
  loginPadre,
  grupoEstudiante,
} = require("../../controller/web/padresController");

const {
  consultarResumenEstudiante,
  consultarAccesosEstudiante,
  consultarAsistenciasEstudiante,
  consultarReportesEstudiante,
} = require("../../controller/movil/estatusEstudianteController");


router.post("/login", loginPadre);

router.get(
  "/estatus/:idEstudiante",
  verificarTokenPadre,
  consultarResumenEstudiante,
);

router.get(
  "/accesos/:idEstudiante",
  verificarTokenPadre,
  consultarAccesosEstudiante,
);

router.get(
  "/asistencias/:idEstudiante",
  verificarTokenPadre,
  consultarAsistenciasEstudiante,
);

router.get(
  "/reportes/:idEstudiante",
  verificarTokenPadre,
  consultarReportesEstudiante,
);

router.get("/grupo/:idEstudiante", verificarTokenPadre, grupoEstudiante);

module.exports = router;
