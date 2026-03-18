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
  crearGrupo,
  getGrupos,
  getGrupoById,
  actualizarGrupo,
  eliminarGrupo,
  cargarGruposMasivos,
} = require("../../controller/web/gruposController");

router.post("/", verificarToken, bitacoraCrear, crearGrupo);
router.get("/", verificarToken, bitacoraConsultar, getGrupos);
router.get("/:id", verificarToken, bitacoraConsultar, getGrupoById);
router.put("/:id", verificarToken, bitacoraActualizar, actualizarGrupo);
router.delete("/:id", verificarToken, bitacoraEliminar, eliminarGrupo);
router.post(
  "/masivo",
  verificarToken,
  upload.single("archivoExcel"),
  bitacoraCargaMasiva,
  cargarGruposMasivos,
);

module.exports = router;
