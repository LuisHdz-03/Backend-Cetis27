const { Router } = require("express");
const router = Router();

const {
  crearAdministrativo,
  getAdministrativos,
} = require("../../controller/web/administrativoController");

router.post("/", crearAdministrativo);
router.get("/", getAdministrativos);

module.exports = router;
