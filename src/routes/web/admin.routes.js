const { Router } = require("express");
const router = Router();

// Ruta base de prueba (GET /api/web)
router.get("/", (req, res) => {
  res.json({ mensaje: "Bienvenido al Dashboard Administrativo (Web)" });
});

// Autenticación
router.use("/auth", require("./authRouter"));

// Gestión Académica
router.use("/estudiantes", require("./estudiantesRoute"));
router.use("/docentes", require("./docenteRoute"));
router.use("/administrativos", require("./adminsRoutes")); // OJO: Checa si en el front usas "admins" o "administrativos"
router.use("/grupos", require("./grupoRoute"));
router.use("/materias", require("./materiasRoute"));
router.use("/clases", require("./claseRoute"));
router.use("/periodos", require("./periodosRouter"));
router.use("/especialidades", require("./especialidadRoute"));

// Gestión Diaria
router.use("/asistencias", require("./asistenciaRoute"));
router.use("/incidencias", require("./reporteRoute"));
router.use("/accesos", require("./accesosRoute"));
router.use("/bitacoras", require("./bitacorasRouter"));

module.exports = router;
