const { Router } = require("express");
const router = Router();

const {
  login,
  cambiarPassword,
  cambiarPasswordObligatorio,
  solicitarRecuperacionPassword,
  restablecerPasswordConToken,
  getMiPerfil,
  registrarCorreo,
  completarPerfil,
  getDatosPerfilEditable,
} = require("../../controller/auth/authController");

const { verificarToken } = require("../../middlewares/authMiddleware");
const {
  bitacoraActualizar,
  bitacoraConsultar,
} = require("../../middlewares/bitacoraMiddleware");
const {
  loginLimiter,
  passwordRecoveryLimiter,
} = require("../../middlewares/rateLimitMiddleware");

router.post("/login", loginLimiter, login);
router.post(
  "/olvide-password",
  passwordRecoveryLimiter,
  solicitarRecuperacionPassword,
);
router.post(
  "/restablecer-password",
  passwordRecoveryLimiter,
  restablecerPasswordConToken,
);
router.put(
  "/cambiar-password",
  bitacoraActualizar,
  cambiarPassword,
);
router.put(
  "/cambiar-password-obligatorio",
  bitacoraActualizar,
  cambiarPasswordObligatorio,
);
router.get("/mi-perfil", verificarToken, bitacoraConsultar, getMiPerfil);
router.get(
  "/perfil-editable",
  bitacoraConsultar,
  getDatosPerfilEditable,
);
router.put(
  "/registrar-correo",
  bitacoraActualizar,
  registrarCorreo,
);
router.put(
  "/completar-perfil",
  bitacoraActualizar,
  completarPerfil,
);

module.exports = router;
