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
  adminODirectivo,
  verificarRol,
} = require("../../middlewares/authMiddleware");
const {
  bitacoraCrear,
  bitacoraConsultar,
  bitacoraActualizar,
  bitacoraCargaMasiva,
} = require("../../middlewares/bitacoraMiddleware");

router.post("/",  adminODirectivo, bitacoraCrear, crearClase);
router.get("/", adminODirectivo, bitacoraConsultar, getClase);
router.get(
  "/docente/:idDocente",
  
  verificarRol("ADMINISTRATIVO", "DIRECTIVO", "DOCENTE"),
  bitacoraConsultar,
  getClaseByDocente,
);
router.put("/:id", adminODirectivo, bitacoraActualizar, actualizarClase);
router.get(
  "/horarios/plantilla/excel",
  
  adminODirectivo,
  bitacoraConsultar,
  descargarPlantillaHorarios,
);
router.post(
  "/horarios/masivo",
  
  adminODirectivo,
  upload.single("archivoExcel"),
  bitacoraCargaMasiva,
  cargarHorariosMasivos,
);

module.exports = router;
