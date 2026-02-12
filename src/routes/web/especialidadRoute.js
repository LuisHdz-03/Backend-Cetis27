const { Router } = require("express");
const router = Router();

const {
  crearEspecialidad,
  getEspecialidad,
} = require("../../controller/web/especialidadController");

router.post("/", crearEspecialidad);
router.get("/", getEspecialidad);

module.exports = router;
