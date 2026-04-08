const { Router } = require("express");
const router = Router();

const {
  crearClase,
  getClase,
  getClaseByDocente,
  actualizarClase,
} = require("../../controller/web/claseController");

const { verificarToken, adminODirectivo } = require("../../middlewares/authMiddleware");
const {
  bitacoraCrear,
  bitacoraConsultar,
  bitacoraActualizar,
} = require("../../middlewares/bitacoraMiddleware");

router.post("/", verificarToken, adminODirectivo, bitacoraCrear, crearClase);
router.get("/", verificarToken, adminODirectivo, bitacoraConsultar, getClase);
router.get(
  "/docente/:idDocente",
  verificarToken,
  adminODirectivo,
  bitacoraConsultar,
  getClaseByDocente,
);
router.put("/:id", verificarToken, adminODirectivo, bitacoraActualizar, actualizarClase);

module.exports = router;
