const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const path = require("path");
const prisma = require("./config/prisma");
const env = require("./config/env");

const app = express();

const allowedOrigins = env.corsOrigins;

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

app.set("trust proxy", env.trustProxy);

app.use(helmet());
if (env.httpLogsEnabled) {
  app.use(morgan(env.isProduction ? "combined" : "dev"));
}
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json({ limit: env.jsonBodyLimit }));
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

app.get("/health/live", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/health/ready", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ready" });
  } catch (error) {
    res.status(503).json({ status: "not_ready" });
  }
});

app.use((err, req, res, next) => {
  if (err && String(err.message || "").includes("CORS")) {
    return res.status(403).json({ error: "Origen no permitido por CORS" });
  }

  if (err) {
    return res.status(500).json({ error: "Error interno del servidor" });
  }

  return next();
});

module.exports = app;
