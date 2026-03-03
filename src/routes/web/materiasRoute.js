const { Router } = require("express");
const router = Router();
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const {
  crearMateria,
  getMateria,
  actualizarMateria,
  eliminarMateria,
  cargarMateriasMasivas,
} = require("../../controller/web/materiasController");

router.post("/", crearMateria);
router.get("/", getMateria);
router.put("/:id", actualizarMateria);
router.delete("/:id", eliminarMateria);
router.post("/masivo", upload.single("archivosExcel"), cargarMateriasMasivas);

module.exports = router;
