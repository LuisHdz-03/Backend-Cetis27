const { Router } = require("express");
const router = Router();
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const {  adminODirectivo } = require("../../middlewares/authMiddleware");
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

router.post("/", dminODirectivo, bitacoraCrear, crearDocente);
router.get("/",  adminODirectivo, bitacoraConsultar, getDocentes);
router.post(
  "/masivo",
  
  adminODirectivo,
  upload.single("archivoExcel"),
  bitacoraCargaMasiva,
  cargarDocentesMasivos,
);
router.get(
  "/plantilla/excel",
  
  adminODirectivo,
  bitacoraConsultar,
  descargarPlantillaDocentes,
);
router.delete("/:id",  adminODirectivo, bitacoraEliminar, eliminarDocente);
router.put("/:id",  adminODirectivo, bitacoraActualizar, actualizarDocente);

module.exports = router;
