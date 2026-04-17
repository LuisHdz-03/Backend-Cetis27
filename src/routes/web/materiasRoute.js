const { Router } = require("express");
const router = Router();
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const { adminODirectivo } = require("../../middlewares/authMiddleware");
const {
  bitacoraCrear,
  bitacoraActualizar,
  bitacoraEliminar,
  bitacoraConsultar,
  bitacoraCargaMasiva,
} = require("../../middlewares/bitacoraMiddleware");

const {
  crearMateria,
  getMateria,
  actualizarMateria,
  eliminarMateria,
  cargarMateriasMasivas,
  getMateriasPorEspecialidad,
  descargarPlantillaMaterias,
} = require("../../controller/web/materiasController");

router.post("/", adminODirectivo, bitacoraCrear, crearMateria);
router.get("/", adminODirectivo, bitacoraConsultar, getMateria);
router.put("/:id", adminODirectivo, bitacoraActualizar, actualizarMateria);
router.delete("/:id", adminODirectivo, bitacoraEliminar, eliminarMateria);
router.post(
  "/masivo",
  adminODirectivo,
  upload.single("archivoExcel"),
  bitacoraCargaMasiva,
  cargarMateriasMasivas,
);
router.get(
  "/especialidad/:especialidadId",
  adminODirectivo,
  bitacoraConsultar,
  getMateriasPorEspecialidad,
);
router.get(
  "/plantilla/excel",
  adminODirectivo,
  bitacoraConsultar,
  descargarPlantillaMaterias,
);

module.exports = router;
