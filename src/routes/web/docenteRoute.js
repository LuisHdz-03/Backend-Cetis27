const { Router } = require("express");
const router = Router();
const { uploadExcelSingle } = require("../../middlewares/excelUploadMiddleware");

const { adminODirectivo } = require("../../middlewares/authMiddleware");
const {
  bitacoraCrear,
  bitacoraActualizar,
  bitacoraEliminar,
  bitacoraConsultar,
  bitacoraCargaMasiva,
} = require("../../middlewares/bitacoraMiddleware");

const {
  crearDocente,
  getDocentes,
  cargarDocentesMasivos,
  eliminarDocente,
  actualizarDocente,
  descargarPlantillaDocentes,
} = require("../../controller/web/docenteController");

router.post("/", adminODirectivo, bitacoraCrear, crearDocente);
router.get("/", adminODirectivo, bitacoraConsultar, getDocentes);
router.post(
  "/masivo",

  adminODirectivo,
  uploadExcelSingle("archivoExcel"),
  bitacoraCargaMasiva,
  cargarDocentesMasivos,
);
router.get(
  "/plantilla/excel",

  adminODirectivo,
  bitacoraConsultar,
  descargarPlantillaDocentes,
);
router.delete("/:id", adminODirectivo, bitacoraEliminar, eliminarDocente);
router.put("/:id", adminODirectivo, bitacoraActualizar, actualizarDocente);

module.exports = router;
