const { Router } = require("express");
const router = Router();
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const {
  crearClase,
  getClase,
  getClaseByDocente,
  actualizarClase,
  descargarPlantillaHorarios,
  cargarHorariosMasivos,
} = require("../../controller/web/claseController");

const {
  verificarToken,
  adminODirectivo,
  verificarRol,
} = require("../../middlewares/authMiddleware");
const {
  bitacoraCrear,
  bitacoraConsultar,
  bitacoraActualizar,
  bitacoraCargaMasiva,
} = require("../../middlewares/bitacoraMiddleware");

router.post("/", verificarToken, adminODirectivo, bitacoraCrear, crearClase);
router.get("/", verificarToken, adminODirectivo, bitacoraConsultar, getClase);
router.get(
  "/docente/:idDocente",
  verificarToken,
  verificarRol("ADMINISTRATIVO", "DIRECTIVO", "DOCENTE"),
  bitacoraConsultar,
  getClaseByDocente,
);
router.put("/:id", verificarToken, adminODirectivo, bitacoraActualizar, actualizarClase);
router.get(
  "/horarios/plantilla/excel",
  verificarToken,
  adminODirectivo,
  bitacoraConsultar,
  descargarPlantillaHorarios,
);
router.post(
  "/horarios/masivo",
  verificarToken,
  adminODirectivo,
  upload.single("archivoExcel"),
  bitacoraCargaMasiva,
  cargarHorariosMasivos,
);

module.exports = router;
