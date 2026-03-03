const { Router } = require("express");
const router = Router();
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const {
  crearGrupo,
  getGrupos,
  getGrupoById,
  actualizarGrupo,
  eliminarGrupo,
  cargarGruposMasivos,
} = require("../../controller/web/gruposController");

router.post("/", crearGrupo);
router.get("/", getGrupos);
router.get("/:id", getGrupoById);
router.put("/:id", actualizarGrupo);
router.delete("/:id", eliminarGrupo);
router.post("/masivo", upload.single("file"), cargarGruposMasivos);

module.exports = router;
