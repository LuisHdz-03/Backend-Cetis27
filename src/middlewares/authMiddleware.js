const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET no está configurada en variables de entorno");
  }
  return process.env.JWT_SECRET;
};

const verificarToken = async (req, res, next) => {
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

  try {
    const decoded = jwt.verify(token, getJwtSecret());

    const usuarioActual = await prisma.usuario.findUnique({
      where: { idUsuario: parseInt(decoded.id, 10) },
      select: {
        idUsuario: true,
        rol: true,
        activo: true,
        nombre: true,
      },
    });

    if (!usuarioActual) {
      return res.status(401).json({ error: "Token inválido: usuario no existe" });
    }

    if (!usuarioActual.activo) {
      return res.status(403).json({ error: "Cuenta desactivada" });
    }

    if ((decoded.rol || "").toUpperCase() !== usuarioActual.rol.toUpperCase()) {
      return res.status(401).json({
        error: "Sesión desactualizada por cambio de permisos. Inicia sesión nuevamente.",
      });
    }

    req.usuario = {
      ...decoded,
      id: usuarioActual.idUsuario,
      rol: usuarioActual.rol,
      nombre: usuarioActual.nombre,
      activo: usuarioActual.activo,
    };

    next();
  } catch (err) {
    if (err.name === "TokenExpiredError" || err.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Token invalido o expirado" });
    }

    console.error("Error validando token:", err);
    return res.status(500).json({ error: "Error interno al validar autenticación" });
  }
};

const verificarTokenPadre = async (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return res.status(403).json({ error: "Error, no hay token" });
  }

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7, authHeader.length)
    : authHeader;

  if (!token) {
    return res.status(403).json({ error: "Formato de token inválido" });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());

    if (!decoded || decoded.tipoAcceso !== "PADRE") {
      return res.status(403).json({ error: "Token no autorizado para acceso de padre" });
    }

    const estudiante = await prisma.estudiante.findUnique({
      where: { idEstudiante: parseInt(decoded.alumnoId, 10) },
      include: {
        usuario: { select: { activo: true } },
      },
    });

    if (!estudiante || !estudiante.usuario?.activo) {
      return res.status(401).json({
        error: "Acceso de padre inválido: alumno no disponible o inactivo",
      });
    }

    req.usuario = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError" || err.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Token inválido o expirado" });
    }
    console.error("Error validando token de padre:", err);
    return res.status(500).json({ error: "Error interno al validar autenticación" });
  }
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
  verificarTokenPadre,
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
