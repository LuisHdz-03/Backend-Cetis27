const { Router } = require("express");
const router = Router();

const {
  registrarAcceso,
  getAccesos,
} = require("../../controller/web/accesosController");

router.post("/", registrarAcceso);
router.get("/", getAccesos);

module.exports = router;
