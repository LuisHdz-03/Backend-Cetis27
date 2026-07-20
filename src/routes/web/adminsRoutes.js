const { Router } = require("express");
const router = Router();
const multer = require("multer");
const {
  uploadExcelSingle,
} = require("../../middlewares/excelUploadMiddleware");
const upload = multer({ storage: multer.memoryStorage() });

const { soloDirectivo } = require("../../middlewares/authMiddleware");
const {
  bitacoraCrear,
  bitacoraActualizar,
  bitacoraEliminar,
  bitacoraConsultar,
  bitacoraCargaMasiva,
} = require("../../middlewares/bitacoraMiddleware");

const {
  crearAdministrativo,
  getAdministrativos,
  cargarAdministrativosMasivos,
  actualizarAdministrativo,
  eliminarAdministrativo,
  descargarPlantillaAdministrativos,
  subirFirmaDirector,
  obtenerDirectorActivo,
  getCargosDisponibles,
} = require("../../controller/web/administrativoController");
router.get("/director", obtenerDirectorActivo);

router.get(
  "/plantilla/excel",

  bitacoraConsultar,
  descargarPlantillaAdministrativos,
);

router.post(
  "/masivo",
  soloDirectivo,
  uploadExcelSingle("archivoExcel"),
  bitacoraCargaMasiva,
  cargarAdministrativosMasivos,
);

router.post(
  "/firma/subir",
  soloDirectivo,
  upload.single("firma"),
  bitacoraActualizar,
  subirFirmaDirector,
);

// RUTAS BASE
router.get("/", soloDirectivo, bitacoraConsultar, getAdministrativos);
router.post("/", soloDirectivo, bitacoraCrear, crearAdministrativo);

router.get("/cargos", soloDirectivo, getCargosDisponibles);

// RUTAS DINÁMICAS (Con :id)
router.put("/:id", soloDirectivo, bitacoraActualizar, actualizarAdministrativo);
router.delete("/:id", soloDirectivo, bitacoraEliminar, eliminarAdministrativo);

// Ruta pública para crear administrativo desde Postman
router.post(
  "/publico",
  require("../../controller/web/administrativoController").crearAdministrativo,
);

module.exports = router;
