const { Router } = require("express");
const router = Router();
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const { verificarToken, adminODirectivo } = require("../../middlewares/authMiddleware");
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
  descargarPlantillaEspecialidades,
} = require("../../controller/web/especialidadController");

router.post("/", verificarToken, adminODirectivo, bitacoraCrear, crearEspecialidad);
router.get("/", verificarToken, adminODirectivo, bitacoraConsultar, getEspecialidad);
router.put("/:id", verificarToken, adminODirectivo, bitacoraActualizar, actualizarEspecialidad);
router.delete("/:id", verificarToken, adminODirectivo, bitacoraEliminar, eliminarEspecialidad);
router.post(
  "/masivo",
  verificarToken,
  adminODirectivo,
  upload.single("archivoExcel"),
  bitacoraCargaMasiva,
  cargarEspecialidadesMasivas,
);
router.get(
  "/plantilla/excel",
  verificarToken,
  adminODirectivo,
  bitacoraConsultar,
  descargarPlantillaEspecialidades,
);
module.exports = router;
