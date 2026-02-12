const { Router } = require("express");
const router = Router();

const {
  registrarAsistencia,
  getAsisPorFecha,
  justificarFalta,
} = require("../../controller/web/asistenciaController");

router.post("/", registrarAsistencia);
router.get("/", getAsisPorFecha);
router.put("/:idAsistencia", justificarFalta);

module.exports = router;
