const { Router } = require("express");
const router = Router();

const {
  crearMateria,
  getMateria,
  eliminarMateria,
} = require("../../controller/web/materiasController");

router.post("/", crearMateria);
router.get("/", getMateria);
router.delete("/:id", eliminarMateria);

module.exports = router;
