const { Router } = require("express");
const router = Router();
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const {
  verificarToken,
  soloDirectivo,
} = require("../../middlewares/authMiddleware");
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
  asignarMateria,
  actualizarAdministrativo,
  eliminarAdministrativo,
  descargarPlantillaAdministrativos,
  subirFirmaDirector,
  obtenerDirectorActivo,
} = require("../../controller/web/administrativoController");

router.post(
  "/",
  verificarToken,
  soloDirectivo,
  bitacoraCrear,
  crearAdministrativo,
);
router.get(
  "/",
  verificarToken,
  soloDirectivo,
  bitacoraConsultar,
  getAdministrativos,
);

router.get("/director", obtenerDirectorActivo);

router.post(
  "/firma/subir",
  verificarToken,
  soloDirectivo,
  upload.single("firma"),
  bitacoraActualizar,
  subirFirmaDirector,
);

router.post(
  "/asignar-materia",
  verificarToken,
  soloDirectivo,
  bitacoraCrear,
  asignarMateria,
);
router.post(
  "/masivo",
  verificarToken,
  soloDirectivo,
  upload.single("archivoExcel"),
  bitacoraCargaMasiva,
  cargarAdministrativosMasivos,
);
router.get(
  "/plantilla/excel",
  verificarToken,
  soloDirectivo,
  bitacoraConsultar,
  descargarPlantillaAdministrativos,
);

router.put(
  "/:id",
  verificarToken,
  soloDirectivo,
  bitacoraActualizar,
  actualizarAdministrativo,
);
router.delete(
  "/:id",
  verificarToken,
  soloDirectivo,
  bitacoraEliminar,
  eliminarAdministrativo,
);

module.exports = router;
