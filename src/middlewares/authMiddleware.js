const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET no está configurada en variables de entorno");
  }
  return process.env.JWT_SECRET;
};

/**
 * Utilidad para extraer el token de diferentes fuentes (Header, Custom Headers, Cookies)
 */
const extractTokenFromRequest = (req) => {
  // 1. Authorization Header
  const authHeader = req.headers["authorization"];
  if (authHeader) {
    return authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : authHeader.trim();
  }

  // 2. Custom Headers
  const tokenHeaders = ["x-access-token", "x-auth-token", "token"];
  for (const headerName of tokenHeaders) {
    const candidate = req.headers[headerName];
    if (candidate) return String(candidate).trim();
  }

  // 3. Cookies
  if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(";").reduce((acc, cookie) => {
      const [key, value] = cookie.split("=").map((c) => c.trim());
      acc[key] = value;
      return acc;
    }, {});

    const cookieKeys = ["token", "access_token", "authToken", "jwt"];
    for (const key of cookieKeys) {
      if (cookies[key]) return decodeURIComponent(cookies[key]).trim();
    }
  }

  return null;
};

const verifyJwtFromRequest = (req, res) => {
  const token = extractTokenFromRequest(req);

  if (!token) {
    res.status(401).json({ error: "No se proporcionó un token de acceso." });
    return null;
  }

  try {
    return jwt.verify(token, getJwtSecret());
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      res.status(401).json({
        code: "SESSION_EXPIRED",
        error: "Tu sesión ha expirado. Ingresa de nuevo.",
      });
      return null;
    }

    if (err.name === "JsonWebTokenError") {
      res.status(401).json({
        code: "INVALID_TOKEN",
        error: "Token de seguridad inválido.",
      });
      return null;
    }

    res
      .status(500)
      .json({ error: "Error de conexión con el servidor de seguridad." });
    return null;
  }
};

/**
 * Middleware principal de autenticación
 */
const verificarToken = async (req, res, next) => {
  try {
    const decoded = verifyJwtFromRequest(req, res);
    if (!decoded) {
      return;
    }

    const userId = parseInt(decoded.id, 10);
    if (isNaN(userId)) {
      return res
        .status(401)
        .json({ error: "Token malformado: ID de usuario inválido." });
    }

    const usuarioActual = await prisma.usuario.findUnique({
      where: { idUsuario: userId },
      select: {
        idUsuario: true,
        rol: true,
        activo: true,
        nombre: true,
        cargo: true,
      },
    });

    if (!usuarioActual) {
      return res
        .status(401)
        .json({ error: "El usuario ya no existe en el sistema." });
    }

    if (!usuarioActual.activo) {
      return res
        .status(403)
        .json({ error: "Esta cuenta ha sido desactivada." });
    }

    // Verificar si el rol en el token coincide con la DB (Seguridad ante cambios de permisos)
    if ((decoded.rol || "").toUpperCase() !== usuarioActual.rol.toUpperCase()) {
      return res.status(401).json({
        error: "Tus permisos han cambiado. Por favor, inicia sesión de nuevo.",
      });
    }

    // Inyectar datos limpios en la request
    req.usuario = {
      ...decoded,
      id: usuarioActual.idUsuario,
      rol: usuarioActual.rol,
      nombre: usuarioActual.nombre,
      activo: usuarioActual.activo,
    };

    next();
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Error de conexión con el servidor de seguridad." });
  }
};

const verificarTokenPadre = async (req, res, next) => {
  try {
    const decoded = verifyJwtFromRequest(req, res);
    if (!decoded) {
      return;
    }

    if (String(decoded.rol || "").toUpperCase() !== "PADRE") {
      return res.status(403).json({
        error: "Este recurso solo está disponible para sesiones de padres.",
      });
    }

    const idEstudiante = parseInt(decoded.idEstudiante, 10);
    if (isNaN(idEstudiante)) {
      return res.status(401).json({
        error: "Token malformado: ID de estudiante inválido.",
      });
    }

    const estudianteActual = await prisma.estudiante.findUnique({
      where: { idEstudiante },
      select: {
        idEstudiante: true,
        usuarioId: true,
        usuario: {
          select: {
            activo: true,
            nombre: true,
          },
        },
      },
    });

    if (!estudianteActual) {
      return res.status(401).json({
        error: "El estudiante vinculado a esta sesión ya no existe.",
      });
    }

    if (!estudianteActual.usuario?.activo) {
      return res.status(403).json({
        error: "La cuenta vinculada a esta sesión ha sido desactivada.",
      });
    }

    req.usuario = {
      rol: "PADRE",
      idEstudiante: estudianteActual.idEstudiante,
      nombre: estudianteActual.usuario.nombre,
      activo: estudianteActual.usuario.activo,
      cargo: usuarioActual.cargo,
    };

    next();
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Error de conexión con el servidor de seguridad." });
  }
};

/**
 * Middleware de autorización por roles
 */
const verificarRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: "Autenticación requerida." });
    }

    const rolUsuario = req.usuario.rol?.toUpperCase();
    const rolesNormalizados = rolesPermitidos.map((r) => r.toUpperCase());

    if (!rolesNormalizados.includes(rolUsuario)) {
      return res.status(403).json({
        error: "No tienes permisos suficientes para realizar esta acción.",
        rolRequerido: rolesPermitidos.join(" o "),
      });
    }
    next();
  };
};

const verificarCargo = (...cargosPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({
        error: "Autenticación requerida.",
      });
    }

    const cargoUsuario = req.usuario.cargo?.toUpperCase();

    const cargosNormalizados = cargosPermitidos.map((cargo) =>
      cargo.toUpperCase(),
    );

    if (!cargosNormalizados.includes(cargoUsuario)) {
      return res.status(403).json({
        error: "Cargo sin permisos",
        cargoActual: req.usuario.cargo,
        cargosPermitidos,
      });
    }

    next();
  };
};

const soloPerfecto = verificarCargo("PREFECTO");

// Middlewares predefinidos listos para usar
const soloDocente = verificarRol("DOCENTE");
const soloAlumno = verificarRol("ALUMNO");
const soloDirectivo = verificarRol("ADMINISTRATIVO", "DIRECTIVO");
const soloGuardia = verificarRol("GUARDIA");
const adminODirectivo = verificarRol("ADMINISTRATIVO", "DIRECTIVO");
const accesoEspecialidades = verificarRol(
  "ADMINISTRATIVO",
  "DIRECTIVO",
  "DOCENTE",
);

module.exports = {
  verificarToken,
  verificarTokenPadre,
  verificarRol,
  soloDocente,
  soloAlumno,
  soloDirectivo,
  soloGuardia,
  adminODirectivo,
  accesoEspecialidades,
  soloPerfecto,
};
