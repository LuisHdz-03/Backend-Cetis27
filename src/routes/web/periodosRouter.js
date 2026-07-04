const { Router } = require("express");
const router = Router();
const {
  crearPeriodo,
  getPeriodos,
  getPeriodoActivo,
  setPeriodoActual,
  cerrarPeriodoYPromover,
  updatePeriodo,
} = require("../../controller/web/periodosController");

const {
  adminODirectivo,
  verificarRol,
} = require("../../middlewares/authMiddleware");
const {
  bitacoraCrear,
  bitacoraConsultar,
  bitacoraActualizar,
} = require("../../middlewares/bitacoraMiddleware");

router.post("/", adminODirectivo, bitacoraCrear, crearPeriodo);
router.get(
  "/",
  verificarRol("ADMINISTRATIVO", "DIRECTIVO", "DOCENTE"),
  bitacoraConsultar,
  getPeriodos,
);
router.get(
  "/activo",
  verificarRol("ADMINISTRATIVO", "DIRECTIVO", "DOCENTE"),
  bitacoraConsultar,
  getPeriodoActivo,
);
router.put(
  "/:idPeriodo",
  adminODirectivo,
  bitacoraActualizar,
  updatePeriodo,
);
router.put(
  "/activar/:idPeriodo",
  adminODirectivo,
  bitacoraActualizar,
  setPeriodoActual,
);
router.post(
  "/:id/cerrar",
  adminODirectivo,
  bitacoraCrear,
  cerrarPeriodoYPromover,
);

module.exports = router;
