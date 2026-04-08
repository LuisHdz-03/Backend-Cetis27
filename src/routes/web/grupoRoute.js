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
  crearGrupo,
  getGrupos,
  getGrupoById,
  actualizarGrupo,
  eliminarGrupo,
  cargarGruposMasivos,
  descargarPlantillaGrupos,
} = require("../../controller/web/gruposController");

router.post("/", verificarToken, adminODirectivo, bitacoraCrear, crearGrupo);
router.get("/", verificarToken, adminODirectivo, bitacoraConsultar, getGrupos);
router.get("/:id", verificarToken, adminODirectivo, bitacoraConsultar, getGrupoById);
router.put("/:id", verificarToken, adminODirectivo, bitacoraActualizar, actualizarGrupo);
router.delete("/:id", verificarToken, adminODirectivo, bitacoraEliminar, eliminarGrupo);
router.post(
  "/masivo",
  verificarToken,
  adminODirectivo,
  upload.single("archivoExcel"),
  bitacoraCargaMasiva,
  cargarGruposMasivos,
);
router.get(
  "/plantilla/excel",
  verificarToken,
  adminODirectivo,
  bitacoraConsultar,
  descargarPlantillaGrupos,
);

module.exports = router;
