const { Router } = require("express");
const router = Router();
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Importamos solo los roles y la bitácora (verificarToken ya se aplicó globalmente en admin.routes.js)
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
} = require("../../controller/web/administrativoController");

// RUTAS ESTÁTICAS (Siempre deben ir antes de las rutas con :id)
router.get("/director", obtenerDirectorActivo);

router.get(
  "/plantilla/excel",
  soloDirectivo,
  bitacoraConsultar,
  descargarPlantillaAdministrativos,
);

router.post(
  "/masivo",
  soloDirectivo,
  upload.single("archivoExcel"),
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

// RUTAS DINÁMICAS (Con :id)
router.put("/:id", soloDirectivo, bitacoraActualizar, actualizarAdministrativo);
router.delete("/:id", soloDirectivo, bitacoraEliminar, eliminarAdministrativo);

module.exports = router;
