const { Router } = require("express");
const router = Router();
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const { adminODirectivo } = require("../../middlewares/authMiddleware");
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

router.post("/", adminODirectivo, bitacoraCrear, crearGrupo);
router.get("/", adminODirectivo, bitacoraConsultar, getGrupos);
router.get("/:id", adminODirectivo, bitacoraConsultar, getGrupoById);
router.put("/:id", adminODirectivo, bitacoraActualizar, actualizarGrupo);
router.delete("/:id", adminODirectivo, bitacoraEliminar, eliminarGrupo);
router.post(
  "/masivo",
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
