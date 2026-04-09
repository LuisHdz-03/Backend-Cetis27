const { Router } = require("express");
const router = Router();
const {
  crearPeriodo,
  getPeriodos,
  getPeriodoActivo,
  setPeriodoActual,
  cerrarPeriodoYPromover,
} = require("../../controller/web/periodosController");

const { verificarToken, adminODirectivo } = require("../../middlewares/authMiddleware");
const {
  bitacoraCrear,
  bitacoraConsultar,
  bitacoraActualizar,
} = require("../../middlewares/bitacoraMiddleware");

router.post("/", verificarToken, adminODirectivo, bitacoraCrear, crearPeriodo);
router.get("/", verificarToken, adminODirectivo, bitacoraConsultar, getPeriodos);
router.get(
  "/activo",
  verificarToken,
  adminODirectivo,
  bitacoraConsultar,
  getPeriodoActivo,
);
router.put(
  "/activar/:idPeriodo",
  verificarToken,
  adminODirectivo,
  bitacoraActualizar,
  setPeriodoActual,
);
router.post(
  "/:id/cerrar",
  verificarToken,
  adminODirectivo,
  bitacoraCrear,
  cerrarPeriodoYPromover,
);

module.exports = router;
