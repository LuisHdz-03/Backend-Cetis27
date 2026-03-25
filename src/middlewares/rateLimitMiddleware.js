const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error:
      "Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.",
  },
  skipSuccessfulRequests: true,
});

module.exports = { loginLimiter };
