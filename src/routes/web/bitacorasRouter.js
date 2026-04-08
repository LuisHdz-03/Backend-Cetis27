const { Router } = require("express");
const router = Router();

const { getBitacora } = require("../../controller/web/bitacoraController");
const { verificarToken, adminODirectivo } = require("../../middlewares/authMiddleware");
const { bitacoraConsultar } = require("../../middlewares/bitacoraMiddleware");

router.get("/", verificarToken, adminODirectivo, bitacoraConsultar, getBitacora);

module.exports = router;
