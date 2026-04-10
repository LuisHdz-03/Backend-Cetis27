const { Router } = require("express");
const router = Router();
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const {
  crearEspacio,
  getEspacios,
  actualizarEspacio,
  eliminarEspacio,
  cargarEspaciosMasivos,
  descargarPlantillaEspacios,
} = require("../../controller/web/espaciosController");

const {
  verificarToken,
  adminODirectivo,
  verificarRol,
} = require("../../middlewares/authMiddleware");

const {
  bitacoraCrear,
  bitacoraActualizar,
  bitacoraEliminar,
  bitacoraConsultar,
  bitacoraCargaMasiva,
} = require("../../middlewares/bitacoraMiddleware");

router.post("/", verificarToken, adminODirectivo, bitacoraCrear, crearEspacio);
router.get(
  "/",
  verificarToken,
  verificarRol("ADMINISTRATIVO", "DIRECTIVO", "DOCENTE", "PREFECTO"),
  bitacoraConsultar,
  getEspacios,
);
router.post(
  "/masivo",
  verificarToken,
  adminODirectivo,
  upload.single("archivoExcel"),
  bitacoraCargaMasiva,
  cargarEspaciosMasivos,
);
router.get(
  "/plantilla/excel",
  verificarToken,
  adminODirectivo,
  bitacoraConsultar,
  descargarPlantillaEspacios,
);
router.put(
  "/:id",
  verificarToken,
  adminODirectivo,
  bitacoraActualizar,
  actualizarEspacio,
);
router.delete(
  "/:id",
  verificarToken,
  adminODirectivo,
  bitacoraEliminar,
  eliminarEspacio,
);

module.exports = router;
