const { Router } = require("express");
const router = Router();
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const {
  adminODirectivo,
  soloDocente,
  accesoEspecialidades,
} = require("../../middlewares/authMiddleware");
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

router.post("/", adminODirectivo, bitacoraCrear, crearEspecialidad);
router.get("/", accesoEspecialidades, bitacoraConsultar, getEspecialidad);
router.put("/:id", adminODirectivo, bitacoraActualizar, actualizarEspecialidad);
router.delete("/:id", adminODirectivo, bitacoraEliminar, eliminarEspecialidad);
router.post(
  "/masivo",

  adminODirectivo,
  upload.single("archivoExcel"),
  bitacoraCargaMasiva,
  cargarEspecialidadesMasivas,
);
router.get(
  "/plantilla/excel",
  adminODirectivo,
  bitacoraConsultar,
  descargarPlantillaEspecialidades,
);
module.exports = router;
