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
const { login } = require("../../controller/auth/authController");
const {
  getAlumnosMovil,
  uploadFotiko,
  actualizartutor,
  getAsistencias,
  getCredencial,
  getHistorialAccesos,
} = require("../../controller/movil/estudianteMoController");

router.get("/", (req, res) => {
  res.json({ mensaje: "Bienvenido a la App Móvil (Estudiantes/Docentes)" });
});

router.post("/auth/login", bitacoraLogin, login);
router.use(verificarToken);

router.get("/perfil", bitacoraConsultar, getAlumnosMovil);
router.put(
  "/perfil/foto",
  uploads.single("fotoPerfil"),
  bitacoraActualizar,
  uploadFotiko,
);
router.post("/perfil/tutor", bitacoraCrear, actualizartutor);

router.get("/credencial", bitacoraConsultar, getCredencial);

router.get("/accesos", bitacoraConsultar, getHistorialAccesos);
router.get("/asistencia", bitacoraConsultar, getAsistencias);

module.exports = router;
