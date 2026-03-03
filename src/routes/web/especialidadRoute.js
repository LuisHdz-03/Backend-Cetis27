const { Router } = require("express");
const router = Router();
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const {
  crearEspecialidad,
  getEspecialidad,
  actualizarEspecialidad,
  eliminarEspecialidad,
  cargarEspecialidadesMasivas,
} = require("../../controller/web/especialidadController");

router.post("/", crearEspecialidad);
router.get("/", getEspecialidad);
router.put("/:id", actualizarEspecialidad);
router.delete("/:id", eliminarEspecialidad);
router.post("/masivo", upload.single("file"), cargarEspecialidadesMasivas);
module.exports = router;
