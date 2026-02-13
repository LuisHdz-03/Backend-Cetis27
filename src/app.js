const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");

const app = express();

app.use(helmet());
app.use(morgan("dev"));
app.use(cors());
app.use(express.json());

app.use("/api/web", require("./routes/web/admin.routes"));

app.use("/api/movil", require("./routes/movil/app.routes"));

app.get("/", (req, res) => {
  res.json({
    status: "online",
    sistema: "Gestion Academica CETIS 27",
    version: "1.0.0",
  });
});

module.exports = app;
