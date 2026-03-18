const { Router } = require("express");
const router = Router();

const {
  registrarAsistencia,
  getAsisPorFecha,
  justificarFalta,
  getHistorialAsistencias,
} = require("../../controller/web/asistenciaController");

const { verificarToken } = require("../../middlewares/authMiddleware");
const {
  bitacoraCrear,
  bitacoraActualizar,
  bitacoraConsultar,
} = require("../../middlewares/bitacoraMiddleware");

router.post("/", verificarToken, bitacoraCrear, registrarAsistencia);
router.get("/", verificarToken, bitacoraConsultar, getAsisPorFecha);
router.put(
  "/:idAsistencia",
  verificarToken,
  bitacoraActualizar,
  justificarFalta,
);
router.get(
  "/historial",
  verificarToken,
  bitacoraConsultar,
  getHistorialAsistencias,
);

module.exports = router;
