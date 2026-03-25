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
const { loginLimiter } = require("../../middlewares/rateLimitMiddleware");

router.post("/login", loginLimiter, bitacoraLogin, login);
router.put(
  "/cambiar-password",
  verificarToken,
  bitacoraActualizar,
  cambiarPassword,
);

module.exports = router;
