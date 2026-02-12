const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");

const app = express();

const { verificarToken } = require("./middlewares/authMiddleware");

app.use(helmet());
app.use(morgan("dev"));
app.use(cors());
app.use(express.json());

//Rutas Web.
app.use("/api/web", require("./routes/web/admin.routes"));

//auth's
app.use("/api/web/auth", require("./routes/web/authRouter"));
app.use("/api/movil/auth", require("./routes/movil/authRoute"));

// routers de la web
app.use("/api/web/estudiantes", require("./routes/web/estudiantesRoute"));
app.use("/api/web/docentes", require("./routes/web/docenteRoute"));
app.use("/api/web/materias", require("./routes/web/materiasRoute"));
app.use("/api/web/grupos", require("./routes/web/grupoRoute"));
app.use("/api/web/clases", require("./routes/web/claseRoute"));
app.use("/api/web/asistencias", require("./routes/web/asistenciaRoute"));
app.use("/api/web/incidencias", require("./routes/web/reporteRoute"));
app.use("/api/web/accesos", require("./routes/web/accesosRoute"));
app.use("/api/web/periodos", require("./routes/web/periodosRouter"));
app.use("/api/web/especialidades", require("./routes/web/especialidadRoute"));
app.use("/api/web/admins", require("./routes/web/adminsRoutes"));
app.use("/api/web/bitacoras", require("./routes/web/bitacorasRouter"));

// routers de la movil.
app.use("/api/movil", require("./routes/movil/app.routes"));

app.get("/", (req, res) => {
  res.json({
    status: "online",
    sistema: "Gestion Academica CETIS 27",
    version: "1.0.0",
  });
});

module.exports = app;
