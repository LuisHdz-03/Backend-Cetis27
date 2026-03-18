const { Router } = require("express");
const router = Router();

const {
  crearClase,
  getClase,
  getClaseByDocente,
} = require("../../controller/web/claseController");

const { verificarToken } = require("../../middlewares/authMiddleware");
const {
  bitacoraCrear,
  bitacoraConsultar,
} = require("../../middlewares/bitacoraMiddleware");

router.post("/", verificarToken, bitacoraCrear, crearClase);
router.get("/", verificarToken, bitacoraConsultar, getClase);
router.get(
  "/docente/:idDocente",
  verificarToken,
  bitacoraConsultar,
  getClaseByDocente,
);

module.exports = router;
