const { Router } = require("express");
const router = Router();

const { verificarToken } = require("../../middlewares/authMiddleware");
const uploads = require("../../middlewares/uploadMiddleware");
const { login } = require("../../controller/auth/authController");
const {
  getAlumnosMovil,
  uploadFotiko,
  actualizartutor,
  getAsistencias,
  getCredencial,
  getHistorialAccesos,
  getHistorialAccesos,
} = require("../../controller/movil/estudianteMoController");

router.get("/", (req, res) => {
  res.json({ mensaje: "Bienvenido a la App Móvil (Estudiantes/Docentes)" });
});

router.post("/auth/login", login);
router.use(verificarToken);

router.get("/perfil", getAlumnosMovil);
router.put("/perfil/foto", uploads.single("fotoPerfil"), uploadFotiko);
router.post("/perfil/tutor", actualizartutor);

router.get("/credencial", getCredencial);

router.get("/accesos", getHistorialAccesos);
router.get("/asistencia", getAsistencias);

module.exports = router;
