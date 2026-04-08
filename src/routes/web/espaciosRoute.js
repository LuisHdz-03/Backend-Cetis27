const { Router } = require("express");
const router = Router();

const {
  crearEspacio,
  getEspacios,
  actualizarEspacio,
  eliminarEspacio,
} = require("../../controller/web/espaciosController");

const { verificarToken, adminODirectivo } = require("../../middlewares/authMiddleware");

const {
  bitacoraCrear,
  bitacoraActualizar,
  bitacoraEliminar,
  bitacoraConsultar,
} = require("../../middlewares/bitacoraMiddleware");

router.post("/", verificarToken, adminODirectivo, bitacoraCrear, crearEspacio);
router.get("/", verificarToken, adminODirectivo, bitacoraConsultar, getEspacios);
router.put("/:id", verificarToken, adminODirectivo, bitacoraActualizar, actualizarEspacio);
router.delete("/:id", verificarToken, adminODirectivo, bitacoraEliminar, eliminarEspacio);

module.exports = router;
