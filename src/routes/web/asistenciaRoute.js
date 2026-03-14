const { Router } = require("express");
const router = Router();

const {
  registrarAsistencia,
  getAsisPorFecha,
  justificarFalta,
  getHistorialAsistencias,
} = require("../../controller/web/asistenciaController");

router.post("/", registrarAsistencia);
router.get("/", getAsisPorFecha);
router.put("/:idAsistencia", justificarFalta);
router.get("/historial", getHistorialAsistencias);

module.exports = router;
