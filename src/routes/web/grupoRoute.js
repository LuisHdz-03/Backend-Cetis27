const { Router } = require("express");
const router = Router();

const {
  crearGrupo,
  getGrupos,
  getGrupoById,
} = require("../../controller/web/gruposController");

router.post("/", crearGrupo);
router.get("/", getGrupos);
router.get("/:id", getGrupoById);

module.exports = router;
