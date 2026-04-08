const nodemailer = require("nodemailer");

const obtenerTransporte = () => {
  const host = process.env.MAIL_HOST;
  const port = parseInt(process.env.MAIL_PORT || "587", 10);
  const secure =
    String(process.env.MAIL_SECURE || "false").toLowerCase() === "true";
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
};

const enviarCorreoRecuperacion = async ({
  emailDestino,
  nombreUsuario,
  token,
}) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const from =
    process.env.MAIL_FROM || process.env.MAIL_USER || "no-reply@cetis27.edu.mx";
  const enlace = `${frontendUrl}/restablecer-password?token=${token}`;

  const transporter = obtenerTransporte();

  if (!transporter) {
    console.warn(
      "[RECUPERACION] SMTP no configurado. Enlace generado:",
      enlace,
    );
    return { enviado: false, enlaceFallback: enlace };
  }

  await transporter.sendMail({
    from,
    to: emailDestino,
    subject: "Recuperación de contraseña - CETIS 27",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #222;">
        <h2>Recuperación de contraseña</h2>
        <p>Hola ${nombreUsuario},</p>
        <p>Recibimos una solicitud para restablecer tu contraseña.</p>
        <p>Haz clic en el siguiente enlace (válido por 15 minutos):</p>
        <p><a href="${enlace}" target="_blank">Restablecer contraseña</a></p>
        <p>Si tú no solicitaste este cambio, ignora este correo.</p>
      </div>
    `,
  });

  return { enviado: true, enlaceFallback: enlace };
};

module.exports = {
  enviarCorreoRecuperacion,
};
