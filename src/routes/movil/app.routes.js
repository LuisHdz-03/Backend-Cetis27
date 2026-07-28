const { Router } = require("express");
const router = Router();

const { verificarToken } = require("../../middlewares/authMiddleware");

const {
  bitacoraLogin,
  bitacoraConsultar,
  bitacoraActualizar,
  bitacoraCrear,
} = require("../../middlewares/bitacoraMiddleware");

const uploads = require("../../middlewares/uploadMiddleware");
const { loginLimiter } = require("../../middlewares/rateLimitMiddleware");

const { login } = require("../../controller/auth/authController");

// =====================================
// CONTROLADORES APP MÓVIL ESTUDIANTE
// =====================================

const {
  getAlumnosMovil,
  uploadFotiko,
  actualizartutor,
  getAsistencias,
  getCredencial,
  getHistorialAccesos,
  getReportesEstudianteMovil,
  cambiarContrasenia,
} = require("../../controller/movil/estudianteMoController");

// =====================================
// GENERAL
// =====================================

router.get("/", (req, res) => {
  res.json({
    mensaje: "Bienvenido a la App Móvil (Estudiantes/Docentes)",
  });
});

// =====================================
// AUTH
// =====================================

router.post("/auth/login", loginLimiter, bitacoraLogin, login);

// =====================================
// APP MÓVIL ESTUDIANTE
// =====================================

router.use(verificarToken);

// Perfil estudiante

router.get("/perfil", bitacoraConsultar, getAlumnosMovil);

// Foto perfil

router.put(
  "/perfil/foto",
  uploads.single("fotoPerfil"),
  bitacoraActualizar,
  uploadFotiko,
);

// Actualizar tutor

router.post("/perfil/tutor", bitacoraCrear, actualizartutor);

// Cambiar contraseña

router.put("/perfil/contrasenia", bitacoraActualizar, cambiarContrasenia);

// Credencial

router.get("/credencial", bitacoraConsultar, getCredencial);

// Historial accesos

router.get("/accesos", bitacoraConsultar, getHistorialAccesos);

// Asistencias

router.get("/asistencias", bitacoraConsultar, getAsistencias);

// Reportes

router.get("/reportes", bitacoraConsultar, getReportesEstudianteMovil);

module.exports = router;
