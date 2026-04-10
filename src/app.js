const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const path = require("path");

const app = express();

const allowedOrigins = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Permite clientes sin Origin (curl, health checks, jobs internos)
    if (!origin) return callback(null, true);

    // Si no hay lista configurada, se permite cualquier origen
    if (allowedOrigins.length === 0) return callback(null, true);

    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin no permitido por CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Access-Token",
    "X-Auth-Token",
    "Token",
  ],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.set("trust proxy", 1);

app.use(helmet());
app.use(morgan("dev"));
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json());
//routes
app.use("/api/web", require("./routes/web/admin.routes"));
app.use("/api/movil", require("./routes/movil/app.routes"));

app.use("/uploads", express.static(path.join(__dirname, "../public/uploads")));

app.get("/", (req, res) => {
  res.json({
    status: "online",
    sistema: "Gestion Academica CETIS 27",
    version: "1.0.0",
  });
});

app.use((err, req, res, next) => {
  if (err && String(err.message || "").includes("CORS")) {
    return res.status(403).json({ error: "Origen no permitido por CORS" });
  }

  if (err) {
    console.error("Error no controlado en Express:", err);
    return res.status(500).json({ error: "Error interno del servidor" });
  }

  return next();
});

module.exports = app;
