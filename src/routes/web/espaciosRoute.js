const { Router } = require("express");
const router = Router();
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const {
  crearEspacio,
  getEspacios,
  actualizarEspacio,
  eliminarEspacio,
  cargarEspaciosMasivos,
  descargarPlantillaEspacios,
} = require("../../controller/web/espaciosController");

const {
  
  adminODirectivo,
} = require("../../middlewares/authMiddleware");

const {
  bitacoraCrear,
  bitacoraActualizar,
  bitacoraEliminar,
  bitacoraConsultar,
  bitacoraCargaMasiva,
} = require("../../middlewares/bitacoraMiddleware");

router.post("/", adminODirectivo, bitacoraCrear, crearEspacio);
router.get("/", bitacoraConsultar, getEspacios);
router.post(
  "/masivo",
  
  adminODirectivo,
  upload.single("archivoExcel"),
  bitacoraCargaMasiva,
  cargarEspaciosMasivos,
);
router.get(
  "/plantilla/excel",
  
  adminODirectivo,
  bitacoraConsultar,
  descargarPlantillaEspacios,
);
router.put(
  "/:id",
  
  adminODirectivo,
  bitacoraActualizar,
  actualizarEspacio,
);
router.delete(
  "/:id",
  
  adminODirectivo,
  bitacoraEliminar,
  eliminarEspacio,
);

module.exports = router;
