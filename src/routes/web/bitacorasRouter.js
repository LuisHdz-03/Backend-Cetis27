const { Router } = require("express");
const router = Router();

const { getBitacora } = require("../../controller/web/bitacoraController");

router.get("/", getBitacora);

module.exports = router;
