const { Router } = require("express");
const router = Router();
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const { verificarToken } = require("../../middlewares/authMiddleware");
const {
  bitacoraCrear,
  bitacoraActualizar,
  bitacoraEliminar,
  bitacoraConsultar,
  bitacoraCargaMasiva,
} = require("../../middlewares/bitacoraMiddleware");

const {
  crearEspecialidad,
  getEspecialidad,
  actualizarEspecialidad,
  eliminarEspecialidad,
  cargarEspecialidadesMasivas,
} = require("../../controller/web/especialidadController");

router.post("/", verificarToken, bitacoraCrear, crearEspecialidad);
router.get("/", verificarToken, bitacoraConsultar, getEspecialidad);
router.put("/:id", verificarToken, bitacoraActualizar, actualizarEspecialidad);
router.delete("/:id", verificarToken, bitacoraEliminar, eliminarEspecialidad);
router.post(
  "/masivo",
  verificarToken,
  upload.single("archivoExcel"),
  bitacoraCargaMasiva,
  cargarEspecialidadesMasivas,
);
module.exports = router;
