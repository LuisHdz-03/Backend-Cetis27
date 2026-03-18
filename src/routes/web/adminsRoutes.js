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
  crearAdministrativo,
  getAdministrativos,
  cargarAdministrativosMasivos,
  asignarMateria,
  actualizarAdministrativo,
  eliminarAdministrativo,
} = require("../../controller/web/administrativoController");

router.post("/", verificarToken, bitacoraCrear, crearAdministrativo);
router.get("/", verificarToken, bitacoraConsultar, getAdministrativos);
router.post("/asignar-materia", verificarToken, bitacoraCrear, asignarMateria);
router.post(
  "/masivo",
  verificarToken,
  upload.single("archivoExcel"),
  bitacoraCargaMasiva,
  cargarAdministrativosMasivos,
);
router.put(
  "/:id",
  verificarToken,
  bitacoraActualizar,
  actualizarAdministrativo,
);
router.delete("/:id", verificarToken, bitacoraEliminar, eliminarAdministrativo);
module.exports = router;
