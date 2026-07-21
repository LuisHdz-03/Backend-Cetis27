const { Router } = require("express");
const router = Router();
const {
  uploadExcelSingle,
} = require("../../middlewares/excelUploadMiddleware");

const {
  adminODirectivo,
  soloGuardia,
} = require("../../middlewares/authMiddleware");
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
router.get(
  "/",
  adminODirectivo,
  soloGuardia,
  adminODirectivo,
  bitacoraConsultar,
  getGrupos,
);
router.get("/:id", adminODirectivo, bitacoraConsultar, getGrupoById);
router.put("/:id", adminODirectivo, bitacoraActualizar, actualizarGrupo);
router.delete("/:id", adminODirectivo, bitacoraEliminar, eliminarGrupo);
router.post(
  "/masivo",
  adminODirectivo,
  uploadExcelSingle("archivoExcel"),
  bitacoraCargaMasiva,
  cargarGruposMasivos,
);
router.get(
  "/plantilla/excel",
  adminODirectivo,
  bitacoraConsultar,
  descargarPlantillaGrupos,
);

module.exports = router;
