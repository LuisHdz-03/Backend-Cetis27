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
  crearMateria,
  getMateria,
  actualizarMateria,
  eliminarMateria,
  cargarMateriasMasivas,
  getMateriasPorEspecialidad,
} = require("../../controller/web/materiasController");

router.post("/", verificarToken, bitacoraCrear, crearMateria);
router.get("/", verificarToken, bitacoraConsultar, getMateria);
router.put("/:id", verificarToken, bitacoraActualizar, actualizarMateria);
router.delete("/:id", verificarToken, bitacoraEliminar, eliminarMateria);
router.post(
  "/masivo",
  verificarToken,
  upload.single("archivoExcel"),
  bitacoraCargaMasiva,
  cargarMateriasMasivas,
);
router.get(
  "/especialidad/:especialidadId",
  verificarToken,
  bitacoraConsultar,
  getMateriasPorEspecialidad,
);

module.exports = router;
