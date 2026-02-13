const { Router } = require("express");
const router = Router();
const { verificarToken } = require("../../middlewares/authMiddleware");

const {
  getAlumnosMovil,
} = require("../../controller/movil/estudianteMoController");

router.get("/perfil", verificarToken, getAlumnosMovil);

module.exports = router;
