const { Router } = require("express");
const router = Router();
const {
  crearPeriodo,
  getPeriodos,
  setPeriodoActual,
  avanzarSemestre,
} = require("../../controller/web/periodosController");

router.post("/", crearPeriodo);
router.get("/", getPeriodos);
router.put("/activar/:idPeriodo", setPeriodoActual);
router.post("/cierre-semestre", avanzarSemestre);

module.exports = router;
