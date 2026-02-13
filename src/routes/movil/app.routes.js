const { Router } = require("express");
const router = Router();

const { verificarToken } = require("../../middlewares/authMiddleware");
const { login } = require("../../controller/auth/authController");
const {
  getAlumnosMovil,
} = require("../../controller/movil/estudianteMoController");

router.get("/", (req, res) => {
  res.json({ mensaje: "Bienvenido a la App Móvil (Estudiantes/Docentes)" });
});

router.post("/auth/login", login);
router.use(verificarToken);

router.get("/perfil", getAlumnosMovil);

module.exports = router;
