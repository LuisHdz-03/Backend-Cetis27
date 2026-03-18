const { Router } = require("express");
const router = Router();

const { getBitacora } = require("../../controller/web/bitacoraController");
const { verificarToken } = require("../../middlewares/authMiddleware");
const { bitacoraConsultar } = require("../../middlewares/bitacoraMiddleware");

router.get("/", verificarToken, bitacoraConsultar, getBitacora);

module.exports = router;
