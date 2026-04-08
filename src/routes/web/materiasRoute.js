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
  crearMateria,
  getMateria,
  actualizarMateria,
  eliminarMateria,
  cargarMateriasMasivas,
  getMateriasPorEspecialidad,
  descargarPlantillaMaterias,
} = require("../../controller/web/materiasController");

router.post("/", verificarToken, adminODirectivo, bitacoraCrear, crearMateria);
router.get("/", verificarToken, adminODirectivo, bitacoraConsultar, getMateria);
router.put("/:id", verificarToken, adminODirectivo, bitacoraActualizar, actualizarMateria);
router.delete("/:id", verificarToken, adminODirectivo, bitacoraEliminar, eliminarMateria);
router.post(
  "/masivo",
  verificarToken,
  adminODirectivo,
  upload.single("archivoExcel"),
  bitacoraCargaMasiva,
  cargarMateriasMasivas,
);
router.get(
  "/especialidad/:especialidadId",
  verificarToken,
  adminODirectivo,
  bitacoraConsultar,
  getMateriasPorEspecialidad,
);
router.get(
  "/plantilla/excel",
  verificarToken,
  adminODirectivo,
  bitacoraConsultar,
  descargarPlantillaMaterias,
);

module.exports = router;
