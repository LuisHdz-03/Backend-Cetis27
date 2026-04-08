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
  crearDocente,
  getDocentes,
  cargarDocentesMasivos,
  eliminarDocente,
  actualizarDocente,
  descargarPlantillaDocentes,
} = require("../../controller/web/docenteController");

router.post("/", verificarToken, adminODirectivo, bitacoraCrear, crearDocente);
router.get("/", verificarToken, adminODirectivo, bitacoraConsultar, getDocentes);
router.post(
  "/masivo",
  verificarToken,
  adminODirectivo,
  upload.single("archivoExcel"),
  bitacoraCargaMasiva,
  cargarDocentesMasivos,
);
router.get(
  "/plantilla/excel",
  verificarToken,
  adminODirectivo,
  bitacoraConsultar,
  descargarPlantillaDocentes,
);
router.delete("/:id", verificarToken, adminODirectivo, bitacoraEliminar, eliminarDocente);
router.put("/:id", verificarToken, adminODirectivo, bitacoraActualizar, actualizarDocente);

module.exports = router;
