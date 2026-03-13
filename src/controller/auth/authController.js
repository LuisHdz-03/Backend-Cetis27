const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const JWT_SECRET = "cetis27_secret_key_2026";

const login = async (req, res) => {
  try {
    const { email, password, plataforma } = req.body;

    if (!email || !password || !plataforma) {
      return res
        .status(400)
        .json({ error: "Faltan credenciales o identificar plataforma." });
    }
    const usuario = await prisma.usuario.findUnique({
      where: { email: email },
      include: {
        perfilEstudiante: { include: { grupo: true } },
        perfilDocente: true,
        perfilAdministrativo: true,
      },
    });
    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }

    const passwordValida = await bcrypt.compare(password, usuario.password);
    if (!passwordValida) {
      return res.status(401).json({ error: "Contraseña incorrecta." });
    }

    if (!usuario.activo) {
      return res.status(403).json({ error: "Cuenta desactivada." });
    }
    if (plataforma === "WEB") {
      if (usuario.rol === "ALUMNO") {
        return res.status(403).json({
          error: "Acceso denegado: Los alumnos deben usar la App Móvil.",
        });
      }
    }

    if (plataforma === "MOVIL") {
      if (usuario.rol === "ADMINISTRATIVO") {
        return res
          .status(403)
          .json({ error: "El personal administrativo debe usar la Web." });
      }
    }

    let perfilData = null;
    if (usuario.rol === "ALUMNO") perfilData = usuario.perfilEstudiante;
    else if (usuario.rol === "DOCENTE") perfilData = usuario.perfilDocente;
    else if (usuario.rol === "ADMINISTRATIVO")
      perfilData = usuario.perfilAdministrativo;

    const token = jwt.sign(
      {
        id: usuario.idUsuario,
        rol: usuario.rol,
        nombre: usuario.nombre,
      },
      JWT_SECRET,
      { expiresIn: plataforma === "WEB" ? "8h" : "7d" },
    );

    res.json({
      mensaje: `Bienvenido a la plataforma ${plataforma}`,
      token,
      usuario: {
        id: usuario.idUsuario,
        nombre: usuario.nombre,
        rol: usuario.rol,
        foto: usuario.fotoUrl,
        datos: perfilData,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor." });
  }
};

const cambiarPassword = async (req, res) => {
  try {
    const { idUsuario, passwordActual, passwordNueva } = req.body;

    if (!idUsuario || !passwordActual || !passwordNueva) {
      return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { idUsuario: parseInt(idUsuario) },
    });

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const isMatch = await bcrypt.compare(passwordActual, usuario.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ error: "La contraseña actual es incorrecta" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(passwordNueva, salt);

    await prisma.usuario.update({
      where: { idUsuario: parseInt(idUsuario) },
      data: { password: hashedPassword },
    });

    res.json({ ok: true, mensaje: "Contraseña actualizada exitosamente" });
  } catch (error) {
    console.error("Error al cambiar contraseña:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

module.exports = { login, cambiarPassword };
