const { Router } = require("express");
const router = Router();

const {
  crearGrupo,
  getGrupos,
  getGrupoById,
  eliminarGrupo,
} = require("../../controller/web/gruposController");

router.post("/", crearGrupo);
router.get("/", getGrupos);
router.get("/:id", getGrupoById);
router.delete("/:id", eliminarGrupo);

module.exports = router;
