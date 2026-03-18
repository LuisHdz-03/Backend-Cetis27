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
  crearDocente,
  getDocentes,
  cargarDocentesMasivos,
  eliminarDocente,
  actualizarDocente,
} = require("../../controller/web/docenteController");

router.post("/", verificarToken, bitacoraCrear, crearDocente);
router.get("/", verificarToken, bitacoraConsultar, getDocentes);
router.post(
  "/masivo",
  verificarToken,
  upload.single("archivoExcel"),
  bitacoraCargaMasiva,
  cargarDocentesMasivos,
);
router.delete("/:id", verificarToken, bitacoraEliminar, eliminarDocente);
router.put("/:id", verificarToken, bitacoraActualizar, actualizarDocente);

module.exports = router;
