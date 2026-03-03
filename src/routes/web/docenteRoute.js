const { Router } = require("express");
const router = Router();
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const {
  crearDocente,
  getDocentes,
  cargarDocentesMasivos,
  eliminarDocente,
  actualizarDocente,
} = require("../../controller/web/docenteController");

router.post("/", crearDocente);
router.get("/", getDocentes);
router.post("/masivo", upload.single("archivoExcel"), cargarDocentesMasivos);
router.delete("/:id", eliminarDocente);
router.put("/:id", actualizarDocente);

module.exports = router;
