const { Router } = require("express");
const router = Router();

const {
  crearDocente,
  getDocentes,
} = require("../../controller/web/docenteController");

router.post("/", crearDocente);
router.get("/", getDocentes);

module.exports = router;
