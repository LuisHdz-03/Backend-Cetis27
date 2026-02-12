const { Router } = require("express");
const router = Router();
const {
  crearPeriodo,
  getPeriodos,
  setPeriodoActual,
} = require("../../controller/web/periodosController");

router.post("/", crearPeriodo);
router.get("/", getPeriodos);
router.put("/activar/:idPeriodo", setPeriodoActual);

module.exports = router;
