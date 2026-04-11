const { Router } = require("express");
const router = Router();

const { verificarToken } = require("../../middlewares/authMiddleware");
const {
  bitacoraConsultar,
  bitacoraActualizar,
  bitacoraCrear,
} = require("../../middlewares/bitacoraMiddleware");
const uploads = require("../../middlewares/uploadMiddleware");
const { loginLimiter } = require("../../middlewares/rateLimitMiddleware");
const { login } = require("../../controller/auth/authController");
const {
  getAlumnosMovil,
  uploadFotiko,
  actualizartutor,
  getAsistencias,
  getCredencial,
  guardarDisenioCredencialMovil,
  getHistorialAccesos,
  getReportesEstudianteMovil,
  cambiarContrasenia,
  verificarFirmaCredencial,
  actualizarDatosContacto,
} = require("../../controller/movil/estudianteMoController");
// Endpoint para que el alumno actualice su correo, teléfono y dirección
router.put("/perfil/contacto", bitacoraActualizar, actualizarDatosContacto);

router.get("/", (req, res) => {
  res.json({ mensaje: "Bienvenido a la App Móvil (Estudiantes/Docentes)" });
});

router.post("/auth/login", loginLimiter, login);
router.use(verificarToken);

router.get("/perfil", bitacoraConsultar, getAlumnosMovil);
router.put(
  "/perfil/foto",
  uploads.single("fotoPerfil"),
  bitacoraActualizar,
  uploadFotiko,
);
router.post("/perfil/tutor", bitacoraCrear, actualizartutor);

router.put("/perfil/contrasenia", bitacoraActualizar, cambiarContrasenia);

router.get("/credencial", bitacoraConsultar, getCredencial);
router.post(
  "/credencial/disenio",
  bitacoraActualizar,
  guardarDisenioCredencialMovil,
);
router.post("/credencial/verificar-firma", verificarFirmaCredencial);

router.get("/accesos", bitacoraConsultar, getHistorialAccesos);
router.get("/asistencias", bitacoraConsultar, getAsistencias);
router.get("/reportes", bitacoraConsultar, getReportesEstudianteMovil);

module.exports = router;
