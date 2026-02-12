const { Router } = require("express");
const router = Router();

router.get("/", (req, res) => {
  res.json({ mensaje: "Bienvenido a la App Móvil (Estudiantes/Docentes)" });
});

module.exports = router;
