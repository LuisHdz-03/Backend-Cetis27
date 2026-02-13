const { Router } = require("express");
const router = Router();

const {
  getAlumnosMovil,
} = require("../../controller/movil/estuudianteMoController");

router.get("/id", getAlumnosMovil);

module.exports = router;
