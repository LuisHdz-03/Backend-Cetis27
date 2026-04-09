const prisma = require("../../config/prisma");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const { enviarCorreoRecuperacion } = require("../../utils/mailer");

const {
  registrarAccionManual,
} = require("../../middlewares/bitacoraMiddleware");

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET no está configurada en variables de entorno");
  }
  return process.env.JWT_SECRET;
};

const login = async (req, res) => {
  try {
    const { username, password, plataforma } = req.body;
    const usernameNormalizado = String(username || "")
      .trim()
      .toLowerCase();

    if (!usernameNormalizado || !password || !plataforma) {
      return res
        .status(400)
        .json({ error: "Faltan credenciales o identificar plataforma." });
    }
    const usuario = await prisma.usuario.findUnique({
      where: { username: usernameNormalizado },
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
    if (usuario.rol === "ALUMNO") {
      perfilData = usuario.perfilEstudiante;
    } else if (usuario.rol === "DOCENTE") {
      perfilData = usuario.perfilDocente;
    } else if (usuario.rol === "ADMINISTRATIVO") {
      perfilData = usuario.perfilAdministrativo;
    } else if (usuario.rol === "DIRECTIVO") {
      perfilData = usuario.perfilAdministrativo;
    } else if (usuario.rol === "PREFECTO") {
      perfilData = usuario.perfilAdministrativo;
    }

    const token = jwt.sign(
      {
        id: usuario.idUsuario,
        rol: usuario.rol,
        nombre: usuario.nombre,
      },
      getJwtSecret(),
      { expiresIn: plataforma === "WEB" ? "8h" : "7d" },
    );

    await registrarAccionManual(
      usuario.idUsuario,
      "LOGIN",
      `Inicio de sesión exitoso desde la plataforma ${plataforma}.`,
    );

    res.json({
      mensaje: `Bienvenido a la plataforma ${plataforma}`,
      token,
      passwordChangeRequired: usuario.passwordChangeRequired,
      usuario: {
        id: usuario.idUsuario,
        username: usuario.username,
        nombre: usuario.nombre,
        apellidoPaterno: usuario.apellidoPaterno || "",
        apellidoMaterno: usuario.apellidoMaterno || "",
        rol: usuario.rol,
        cargo: perfilData?.cargo || null,
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
    // idUsuario siempre viene del JWT (req.usuario), nunca del body
    const idUsuario = req.usuario?.id;
    const { passwordActual, passwordNueva } = req.body;

    if (!idUsuario || !passwordActual || !passwordNueva) {
      return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    if (passwordNueva.length < 8) {
      return res.status(400).json({
        error: "La nueva contraseña debe tener al menos 8 caracteres",
      });
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

    await registrarAccionManual(
      usuario.idUsuario,
      "ACTUALIZAR CONTRASEÑA",
      "El usuario actualizó su contraseña por medidas de seguridad.",
    );

    res.json({ ok: true, mensaje: "Contraseña actualizada exitosamente" });
  } catch (error) {
    console.error("Error al cambiar contraseña:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// Endpoint especial para cambio de contraseña obligatorio en el primer login
const cambiarPasswordObligatorio = async (req, res) => {
  try {
    const { passwordNueva } = req.body;
    const idUsuario = req.usuario?.id;

    if (!idUsuario || !passwordNueva) {
      return res
        .status(400)
        .json({ error: "Faltan datos obligatorios (passwordNueva)" });
    }

    if (passwordNueva.length < 8) {
      return res.status(400).json({
        error: "La nueva contraseña debe tener al menos 8 caracteres",
      });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { idUsuario: parseInt(idUsuario) },
    });

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    if (!usuario.passwordChangeRequired) {
      return res
        .status(400)
        .json({ error: "Este usuario ya cambió su contraseña" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(passwordNueva, salt);

    await prisma.usuario.update({
      where: { idUsuario: parseInt(idUsuario) },
      data: {
        password: hashedPassword,
        passwordChangeRequired: false,
      },
    });

    await registrarAccionManual(
      usuario.idUsuario,
      "CAMBIO CONTRASEÑA OBLIGATORIO",
      "El usuario cambió su contraseña obligatoria de primer login.",
    );

    res.json({
      ok: true,
      mensaje:
        "Contraseña actualizada exitosamente. Por favor, inicia sesión nuevamente con tu nueva contraseña.",
    });
  } catch (error) {
    console.error("Error al cambiar contraseña obligatoria:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// Helper interno: genera token, lo guarda y envía el correo
const generarYEnviarTokenRecuperacion = async (usuario, emailDestino) => {
  const tokenPlano = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto
    .createHash("sha256")
    .update(tokenPlano)
    .digest("hex");
  const expiracion = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.usuario.update({
    where: { idUsuario: usuario.idUsuario },
    data: {
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpiresAt: expiracion,
    },
  });

  await enviarCorreoRecuperacion({
    emailDestino,
    nombreUsuario: `${usuario.nombre} ${usuario.apellidoPaterno}`.trim(),
    token: tokenPlano,
  });

  await registrarAccionManual(
    usuario.idUsuario,
    "SOLICITUD RECUPERACION PASSWORD",
    "Se generó token de recuperación de contraseña por correo.",
  );
};

// Flujo:
// 1. Enviar { username } → si tiene correo, se manda el enlace.
// 2. Si no tiene correo, back responde { ok: false, necesitaCorreo: true }.
// 3. Cliente reenvía { username, email, curp } → back verifica CURP, registra
//    el correo y manda el enlace de recuperación.
const solicitarRecuperacionPassword = async (req, res) => {
  try {
    const { username, email, curp } = req.body;
    const usernameNormalizado = String(username || "")
      .trim()
      .toLowerCase();

    if (!usernameNormalizado) {
      return res
        .status(400)
        .json({ error: "El nombre de usuario es obligatorio" });
    }

    // Respuesta genérica para evitar enumeración de usuarios
    const mensajeGenerico =
      "Si los datos son correctos, se enviará un enlace de recuperación al correo registrado.";

    const usuario = await prisma.usuario.findFirst({
      where: { username: usernameNormalizado, activo: true },
    });

    if (!usuario) {
      return res.json({ ok: true, mensaje: mensajeGenerico });
    }

    // --- Caso 1: el usuario ya tiene correo registrado ---
    if (usuario.email) {
      await generarYEnviarTokenRecuperacion(usuario, usuario.email);
      return res.json({ ok: true, mensaje: mensajeGenerico });
    }

    // --- Caso 2: usuario sin correo ---
    const emailNormalizado = String(email || "")
      .trim()
      .toLowerCase();
    const curpNormalizada = String(curp || "")
      .trim()
      .toUpperCase();

    // Si no se proporcionó email+CURP, informar al frontend que los necesita
    if (!emailNormalizado || !curpNormalizada) {
      return res.status(200).json({
        ok: false,
        necesitaCorreo: true,
        mensaje:
          "Este usuario no tiene correo registrado. Proporciona tu correo y CURP para verificar tu identidad y continuar.",
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailNormalizado)) {
      return res
        .status(400)
        .json({ error: "El formato del correo no es válido" });
    }

    // Verificar identidad con CURP
    if (!usuario.curp || usuario.curp.toUpperCase() !== curpNormalizada) {
      return res.status(400).json({
        error: "Los datos no coinciden con los registros del sistema",
      });
    }

    // Verificar que el correo no esté en uso por otro usuario
    const correoOcupado = await prisma.usuario.findFirst({
      where: {
        email: emailNormalizado,
        idUsuario: { not: usuario.idUsuario },
      },
    });
    if (correoOcupado) {
      return res.status(409).json({
        error: "El correo ya está registrado en el sistema por otro usuario",
      });
    }

    // Registrar el correo en la cuenta del usuario
    await prisma.usuario.update({
      where: { idUsuario: usuario.idUsuario },
      data: { email: emailNormalizado },
    });

    await registrarAccionManual(
      usuario.idUsuario,
      "REGISTRAR CORREO EN RECUPERACION",
      `Se registró correo durante recuperación de contraseña (verificado con CURP).`,
    );

    await generarYEnviarTokenRecuperacion(
      { ...usuario, email: emailNormalizado },
      emailNormalizado,
    );

    return res.json({ ok: true, mensaje: mensajeGenerico });
  } catch (error) {
    console.error("Error al solicitar recuperación de contraseña:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
};

const restablecerPasswordConToken = async (req, res) => {
  try {
    const { token, passwordNueva } = req.body;

    if (!token || !passwordNueva) {
      return res.status(400).json({
        error: "Faltan datos obligatorios (token, passwordNueva)",
      });
    }

    if (passwordNueva.length < 8) {
      return res.status(400).json({
        error: "La nueva contraseña debe tener al menos 8 caracteres",
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(String(token))
      .digest("hex");

    const usuario = await prisma.usuario.findFirst({
      where: {
        resetPasswordTokenHash: tokenHash,
        resetPasswordExpiresAt: {
          gt: new Date(),
        },
        activo: true,
      },
    });

    if (!usuario) {
      return res.status(400).json({
        error: "Token inválido o expirado",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(passwordNueva, salt);

    await prisma.usuario.update({
      where: { idUsuario: usuario.idUsuario },
      data: {
        password: hashedPassword,
        passwordChangeRequired: false,
        resetPasswordTokenHash: null,
        resetPasswordExpiresAt: null,
      },
    });

    await registrarAccionManual(
      usuario.idUsuario,
      "RESTABLECER PASSWORD",
      "El usuario restableció su contraseña con token de correo.",
    );

    return res.json({
      ok: true,
      mensaje: "Contraseña restablecida correctamente",
    });
  } catch (error) {
    console.error("Error al restablecer contraseña:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
};

const getMiPerfil = async (req, res) => {
  try {
    const idUsuario = req.usuario?.id;

    if (!idUsuario) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { idUsuario: parseInt(idUsuario, 10) },
      include: {
        perfilEstudiante: true,
        perfilDocente: true,
        perfilAdministrativo: true,
      },
    });

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    let perfil = null;
    if (usuario.rol === "ALUMNO") {
      perfil = usuario.perfilEstudiante;
    } else if (usuario.rol === "DOCENTE") {
      perfil = usuario.perfilDocente;
    } else {
      perfil = usuario.perfilAdministrativo;
    }

    return res.json({
      ok: true,
      usuario: {
        id: usuario.idUsuario,
        username: usuario.username,
        nombre: usuario.nombre,
        apellidoPaterno: usuario.apellidoPaterno,
        apellidoMaterno: usuario.apellidoMaterno,
        email: usuario.email,
        telefono: usuario.telefono,
        curp: usuario.curp,
        rol: usuario.rol,
        activo: usuario.activo,
        perfil,
      },
      capacidades: {
        accesoInstitucionalCompleto: ["DIRECTIVO", "ADMINISTRATIVO"].includes(
          usuario.rol,
        ),
        puedeVerBitacoraCompleta: ["DIRECTIVO", "ADMINISTRATIVO"].includes(
          usuario.rol,
        ),
      },
    });
  } catch (error) {
    console.error("Error al obtener mi perfil:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
};

// Permite que un usuario autenticado registre o actualice su correo
const registrarCorreo = async (req, res) => {
  try {
    const idUsuario = req.usuario?.id;
    const { email } = req.body;
    const emailNormalizado = String(email || "")
      .trim()
      .toLowerCase();

    if (!emailNormalizado) {
      return res.status(400).json({ error: "El correo es obligatorio" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailNormalizado)) {
      return res
        .status(400)
        .json({ error: "El formato del correo no es válido" });
    }

    // Verificar que no esté en uso por otro usuario
    const correoOcupado = await prisma.usuario.findFirst({
      where: {
        email: emailNormalizado,
        idUsuario: { not: parseInt(idUsuario) },
      },
    });
    if (correoOcupado) {
      return res.status(409).json({
        error: "El correo ya está registrado en el sistema por otro usuario",
      });
    }

    await prisma.usuario.update({
      where: { idUsuario: parseInt(idUsuario) },
      data: { email: emailNormalizado },
    });

    await registrarAccionManual(
      parseInt(idUsuario),
      "REGISTRAR CORREO",
      `El usuario registró/actualizó su correo electrónico.`,
    );

    return res.json({ ok: true, mensaje: "Correo registrado correctamente" });
  } catch (error) {
    console.error("Error al registrar correo:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
};

// Permite completar/actualizar datos personales faltantes del perfil
const completarPerfil = async (req, res) => {
  try {
    const idUsuario = req.usuario?.id;
    const { email, telefono, direccion, fechaNacimiento } = req.body;

    if (!idUsuario) {
      return res.status(401).json({ error: "No autenticado" });
    }

    if (
      email === undefined &&
      telefono === undefined &&
      direccion === undefined &&
      fechaNacimiento === undefined
    ) {
      return res.status(400).json({
        error:
          "Debes enviar al menos uno de estos campos: email, telefono, direccion, fechaNacimiento",
      });
    }

    const dataUpdate = {};

    if (email !== undefined) {
      const emailNormalizado = String(email || "")
        .trim()
        .toLowerCase();
      if (!emailNormalizado) {
        return res
          .status(400)
          .json({ error: "El correo no puede estar vacío" });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailNormalizado)) {
        return res
          .status(400)
          .json({ error: "El formato del correo no es válido" });
      }

      const correoOcupado = await prisma.usuario.findFirst({
        where: {
          email: emailNormalizado,
          idUsuario: { not: parseInt(idUsuario, 10) },
        },
      });

      if (correoOcupado) {
        return res.status(409).json({
          error: "El correo ya está registrado en el sistema por otro usuario",
        });
      }

      dataUpdate.email = emailNormalizado;
    }

    if (telefono !== undefined) {
      const telefonoNormalizado = String(telefono || "").trim();
      if (!telefonoNormalizado) {
        return res
          .status(400)
          .json({ error: "El teléfono no puede estar vacío" });
      }

      const telefonoRegex = /^[0-9+\-()\s]{7,20}$/;
      if (!telefonoRegex.test(telefonoNormalizado)) {
        return res.status(400).json({
          error: "El teléfono tiene un formato inválido",
        });
      }

      dataUpdate.telefono = telefonoNormalizado;
    }

    if (direccion !== undefined) {
      const direccionNormalizada = String(direccion || "").trim();
      if (!direccionNormalizada) {
        return res
          .status(400)
          .json({ error: "La dirección no puede estar vacía" });
      }
      dataUpdate.direccion = direccionNormalizada;
    }

    if (fechaNacimiento !== undefined) {
      const fecha = new Date(fechaNacimiento);
      if (isNaN(fecha.getTime())) {
        return res.status(400).json({ error: "Fecha de nacimiento inválida" });
      }
      dataUpdate.fechaNacimiento = fecha;
    }

    const usuarioActualizado = await prisma.usuario.update({
      where: { idUsuario: parseInt(idUsuario, 10) },
      data: dataUpdate,
      select: {
        idUsuario: true,
        email: true,
        telefono: true,
        direccion: true,
        fechaNacimiento: true,
      },
    });

    const camposFaltantes = [
      !usuarioActualizado.email ? "email" : null,
      !usuarioActualizado.telefono ? "telefono" : null,
      !usuarioActualizado.direccion ? "direccion" : null,
      !usuarioActualizado.fechaNacimiento ? "fechaNacimiento" : null,
    ].filter(Boolean);

    await registrarAccionManual(
      parseInt(idUsuario, 10),
      "COMPLETAR PERFIL",
      `El usuario actualizó su información personal. Campos editados: ${Object.keys(dataUpdate).join(", ")}`,
    );

    return res.json({
      ok: true,
      mensaje: "Perfil actualizado correctamente",
      usuario: usuarioActualizado,
      perfilCompleto: camposFaltantes.length === 0,
      camposFaltantes,
    });
  } catch (error) {
    console.error("Error al completar perfil:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
};

// Obtiene solo los datos personales editables para completar perfil
const getDatosPerfilEditable = async (req, res) => {
  try {
    const idUsuario = req.usuario?.id;

    if (!idUsuario) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { idUsuario: parseInt(idUsuario, 10) },
      select: {
        idUsuario: true,
        email: true,
        telefono: true,
        direccion: true,
        fechaNacimiento: true,
      },
    });

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const camposFaltantes = [
      !usuario.email ? "email" : null,
      !usuario.telefono ? "telefono" : null,
      !usuario.direccion ? "direccion" : null,
      !usuario.fechaNacimiento ? "fechaNacimiento" : null,
    ].filter(Boolean);

    return res.json({
      ok: true,
      datos: usuario,
      perfilCompleto: camposFaltantes.length === 0,
      camposFaltantes,
    });
  } catch (error) {
    console.error("Error al obtener datos editables de perfil:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
};

module.exports = {
  login,
  cambiarPassword,
  cambiarPasswordObligatorio,
  solicitarRecuperacionPassword,
  restablecerPasswordConToken,
  getMiPerfil,
  registrarCorreo,
  completarPerfil,
  getDatosPerfilEditable,
};
