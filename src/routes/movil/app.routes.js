const { Router } = require("express");
const router = Router();

const {
  verificarToken,
  verificarTokenPadre,
} = require("../../middlewares/authMiddleware");
const {
  bitacoraLogin,
  bitacoraConsultar,
  bitacoraActualizar,
  bitacoraCrear,
} = require("../../middlewares/bitacoraMiddleware");
const uploads = require("../../middlewares/uploadMiddleware");
const { loginLimiter } = require("../../middlewares/rateLimitMiddleware");
const { login } = require("../../controller/auth/authController");
const { loginPadre } = require("../../controller/web/padresController");
const {
  consultarEstatusCompletoEstudiante,
} = require("../../controller/movil/estatusEstudianteController");
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

router.get("/", (req, res) => {
  res.json({ mensaje: "Bienvenido a la App Móvil (Estudiantes/Docentes)" });
});

router.post("/auth/login", loginLimiter, bitacoraLogin, login);
router.post("/padres/login", loginPadre);
router.post("/padre/login", loginPadre);
router.post("/movil/padres/login", loginPadre);
router.post("/movil/padre/login", loginPadre);
router.get(
  "/padres/estatus-completo/:idEstudiante",
  verificarTokenPadre,
  consultarEstatusCompletoEstudiante,
);
router.get(
  "/padre/estatus-completo/:idEstudiante",
  verificarTokenPadre,
  consultarEstatusCompletoEstudiante,
);
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

router.get("/credencial", verificarToken, bitacoraConsultar, getCredencial);

router.get("/accesos", bitacoraConsultar, getHistorialAccesos);
router.get("/asistencias", bitacoraConsultar, getAsistencias);
router.get("/reportes", bitacoraConsultar, getReportesEstudianteMovil);

module.exports = router;
