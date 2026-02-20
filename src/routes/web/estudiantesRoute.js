const { Router } = require("express");
const router = Router();
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const {
  crearEstudiante,
  getEstudiantes,
  cargarDatosMasivos,
  actualizarEstudiante,
  eliminarEstudiante,
} = require("../../controller/web/estudianteController");

router.post("/", crearEstudiante);
router.get("/", getEstudiantes);
router.post("/masivo", upload.single("archivoExcel"), cargarDatosMasivos);
router.put("/:id", actualizarEstudiante);
router.delete("/:id", eliminarEstudiante);

module.exports = router;
