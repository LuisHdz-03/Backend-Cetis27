const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error:
      "Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.",
  },
  skipSuccessfulRequests: true,
});

const parentAccessLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 20, // hasta 20 intentos
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error:
      "Demasiados intentos de acceso de tutor. Intenta nuevamente en 5 minutos.",
  },
  skipSuccessfulRequests: true,
});

// Limiter para solicitar/restablecer contraseña por correo
const passwordRecoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // ventana de 15 minutos
  max: 5,                    // máx 5 solicitudes por IP en esa ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error:
      "Demasiadas solicitudes de recuperación de contraseña. Intenta de nuevo en 15 minutos.",
  },
});

module.exports = { loginLimiter, parentAccessLimiter, passwordRecoveryLimiter };
