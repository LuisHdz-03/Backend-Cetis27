const { Router } = require("express");
const router = Router();

const {
  crearReporte,
  getReporte,
  atenderReporte,
  getHistorialAlumno,
} = require("../../controller/web/incidenciasController");

router.post("/", crearReporte);
router.get("/", getReporte);
router.put("/", atenderReporte);
router.get("/alumno/:alumnoId", getHistorialAlumno);

module.exports = router;
