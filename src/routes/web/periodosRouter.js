const { Router } = require("express");
const router = Router();
const {
  crearPeriodo,
  getPeriodos,
  setPeriodoActual,
  cerrarPeriodoYPromover,
} = require("../../controller/web/periodosController");

const { verificarToken } = require("../../middlewares/authMiddleware");
const {
  bitacoraCrear,
  bitacoraConsultar,
  bitacoraActualizar,
} = require("../../middlewares/bitacoraMiddleware");

router.post("/", verificarToken, bitacoraCrear, crearPeriodo);
router.get("/", verificarToken, bitacoraConsultar, getPeriodos);
router.put(
  "/activar/:idPeriodo",
  verificarToken,
  bitacoraActualizar,
  setPeriodoActual,
);
router.post(
  "/:id/cerrar",
  verificarToken,
  bitacoraCrear,
  cerrarPeriodoYPromover,
);

module.exports = router;
