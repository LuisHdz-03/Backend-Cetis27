const { Router } = require("express");
const router = Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const {
  crearDocente,
  getDocentes,
  cargarDocentesMasivos,
} = require("../../controller/web/docenteController");
const multer = require("multer");

router.post("/", crearDocente);
router.get("/", getDocentes);
router.post("/masivo", upload.single("archivosExcel"), cargarDocentesMasivos);

module.exports = router;
