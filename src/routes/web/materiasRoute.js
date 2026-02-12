const { Router } = require("express");
const router = Router();

const {
  crearMateria,
  getMateria,
} = require("../../controller/web/materiasController");

router.post("/", crearMateria);
router.get("/", getMateria);

module.exports = router;
