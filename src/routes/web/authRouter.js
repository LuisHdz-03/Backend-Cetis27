const { Router } = require("express");
const router = Router();

const {
  login,
  cambiarPassword,
} = require("../../controller/auth/authController");

const { verificarToken } = require("../../middlewares/authMiddleware");
const {
  bitacoraLogin,
  bitacoraActualizar,
} = require("../../middlewares/bitacoraMiddleware");

router.post("/login", bitacoraLogin, login);
router.put(
  "/cambiar-password",
  verificarToken,
  bitacoraActualizar,
  cambiarPassword,
);

module.exports = router;
