const { Router } = require("express");
const router = Router();
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const {
  crearEstudiante,
  getEstudiantes,
  cargarDatosMasivos,
} = require("../../controller/web/estudianteController");

router.post("/", crearEstudiante);
router.get("/", getEstudiantes);
router.post("/masivo", upload.single("archivoExcel"), cargarDatosMasivos);

module.exports = router;
