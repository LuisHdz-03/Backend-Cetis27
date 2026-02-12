const jwt = require("jsonwebtoken");

const JWT_SECRET = "cetis27_secret_key_2026";

const verificarToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return res.status(403).json({ error: "Error, no hay token " });
  }

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7, authHeader.length)
    : authHeader;

  if (!token) {
    return res.status(403).json({ error: "Formato de token invalido" });
  }
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: "Token invalido o expirado" });
    }
    req.usuario = decoded;

    next();
  });
};
const soloAdmin = (req, res, next) => {
  if (req.usuario.rol !== "ADMINISTRATIVO" && req.usuario.rol !== "DIRECTIVO") {
    return res
      .status(403)
      .json({ error: "Requiere privilegios de Administrador." });
  }
  next();
};

module.exports = { verificarToken, soloAdmin };
