const { Router } = require("express");
const router = Router();

const {
  crearClase,
  getClase,
  getClaseByDocente,
} = require("../../controller/web/claseController");

router.post("/", crearClase);
router.get("/", getClase);
router.get("/", getClaseByDocente);

module.exports = router;
