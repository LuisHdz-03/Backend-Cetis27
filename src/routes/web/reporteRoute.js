const { Router } = require("express");
const router = Router();

const {
  crearReporte,
  getReporte,
  atenderReporte,
  getHistorialAlumno,
} = require("../../controller/web/incidenciasController");

const { verificarToken } = require("../../middlewares/authMiddleware");
const {
  bitacoraCrear,
  bitacoraConsultar,
  bitacoraActualizar,
} = require("../../middlewares/bitacoraMiddleware");

router.post("/", verificarToken, bitacoraCrear, crearReporte);
router.get("/", verificarToken, bitacoraConsultar, getReporte);
router.put("/:reporteId", verificarToken, bitacoraActualizar, atenderReporte);
router.get(
  "/alumno/:alumnoId",
  verificarToken,
  bitacoraConsultar,
  getHistorialAlumno,
);

module.exports = router;
