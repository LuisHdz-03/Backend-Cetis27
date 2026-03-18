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

/**
 * Middleware flexible para verificar roles
 * @param {...string} rolesPermitidos - Lista de roles permitidos
 * @returns {Function} Middleware que verifica si el usuario tiene alguno de los roles
 *
 * Ejemplo de uso:
 * router.get("/ruta", verificarToken, verificarRol("ADMIN", "DIRECTIVO"), controlador);
 */
const verificarRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    // Verificar si existe el usuario (debe haber pasado por verificarToken)
    if (!req.usuario) {
      return res.status(401).json({
        error: "No autenticado. Debe proporcionar un token válido.",
      });
    }

    // Verificar si el usuario tiene alguno de los roles permitidos
    const rolUsuario = req.usuario.rol?.toUpperCase();
    const rolesNormalizados = rolesPermitidos.map((rol) => rol.toUpperCase());

    if (!rolesNormalizados.includes(rolUsuario)) {
      return res.status(403).json({
        error: `Acceso denegado. Se requiere uno de estos roles: ${rolesPermitidos.join(", ")}`,
        rolActual: req.usuario.rol,
      });
    }

    next();
  };
};

/**
 * Middleware para verificar que el usuario esté activo
 */
const verificarActivo = (req, res, next) => {
  if (!req.usuario) {
    return res.status(401).json({
      error: "No autenticado.",
    });
  }

  if (req.usuario.activo === false) {
    return res.status(403).json({
      error: "Tu cuenta está desactivada. Contacta al administrador.",
    });
  }

  next();
};

/**
 * Middlewares predefinidos para roles específicos
 */
const soloDocente = verificarRol("DOCENTE");
const soloAlumno = verificarRol("ALUMNO");
const soloDirectivo = verificarRol("DIRECTIVO");
const soloGuardia = verificarRol("GUARDIA");
const adminODirectivo = verificarRol("ADMINISTRATIVO", "DIRECTIVO");
const docenteODirectivo = verificarRol("DOCENTE", "DIRECTIVO");

module.exports = {
  verificarToken,
  soloAdmin,
  verificarRol,
  verificarActivo,
  // Exportar middlewares predefinidos
  soloDocente,
  soloAlumno,
  soloDirectivo,
  soloGuardia,
  adminODirectivo,
  docenteODirectivo,
};
