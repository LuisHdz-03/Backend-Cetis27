const { Router } = require("express");
const router = Router();

const {
  registrarAcceso,
  getAccesos,
} = require("../../controller/web/accesosController");

const { verificarToken } = require("../../middlewares/authMiddleware");
const {
  bitacoraCrear,
  bitacoraConsultar,
} = require("../../middlewares/bitacoraMiddleware");

router.post("/", verificarToken, bitacoraCrear, registrarAcceso);
router.get("/", verificarToken, bitacoraConsultar, getAccesos);

module.exports = router;
