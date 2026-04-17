const { Router } = require("express");
const router = Router();

const {
  registrarAcceso,
  getAccesos,
} = require("../../controller/web/accesosController");

const { verificarRol } = require("../../middlewares/authMiddleware");
const {
  bitacoraCrear,
  bitacoraConsultar,
} = require("../../middlewares/bitacoraMiddleware");

router.post(
  "/",
  verificarRol("GUARDIA", "PREFECTO", "ADMINISTRATIVO", "DIRECTIVO"),
  bitacoraCrear,
  registrarAcceso,
);
router.get(
  "/",
  verificarRol("GUARDIA", "PREFECTO", "ADMINISTRATIVO", "DIRECTIVO"),
  bitacoraConsultar,
  getAccesos,
);

module.exports = router;
