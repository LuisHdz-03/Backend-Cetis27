const prisma = require("../config/prisma");

/**
 * Middleware para registrar automáticamente acciones en la bitácora
 * Se debe usar después de verificarToken para tener acceso a req.usuario
 */
const registrarEnBitacora = (accionBase) => {
  return async (req, res, next) => {
    // Guardamos el método original res.json para interceptarlo
    const originalJson = res.json.bind(res);

    // Sobrescribimos res.json para capturar respuestas exitosas
    res.json = function (data) {
      // Solo registrar si la respuesta es exitosa (status 200-299)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Registrar en bitácora de forma asíncrona (no bloqueante)
        registrarAccionEnBitacora(req, accionBase, data).catch((error) => {
          console.error("Error al registrar en bitácora:", error);
        });
      }

      // Llamar al método original para enviar la respuesta
      return originalJson(data);
    };

    next();
  };
};

/**
 * Función auxiliar para registrar en bitácora
 */
async function registrarAccionEnBitacora(req, accionBase, responseData) {
  try {
    // Verificar que haya un usuario autenticado
    if (!req.usuario || !req.usuario.id) {
      return;
    }

    // Construir la acción basada en el método HTTP y la ruta
    let accion = accionBase || construirAccion(req);

    // Construir detalles basados en el método y datos
    let detalle = construirDetalle(req, responseData);

    // Registrar en la base de datos
    await prisma.bitacora.create({
      data: {
        usuarioId: parseInt(req.usuario.id),
        accion: accion,
        detalle: detalle,
      },
    });
  } catch (error) {
    console.error("❌ Error al guardar en bitácora:", error);
  }
}

function construirAccion(req) {
  const metodo = req.method;
  const ruta = req.route?.path || req.path;

  const accionesPorMetodo = {
    POST: "CREAR",
    PUT: "ACTUALIZAR",
    PATCH: "ACTUALIZAR",
    DELETE: "ELIMINAR",
    GET: "CONSULTAR",
  };

  const accionBase = accionesPorMetodo[metodo] || "ACCIÓN";

  // Intentar extraer el recurso de la ruta
  const segmentos = ruta.split("/").filter((s) => s && !s.startsWith(":"));
  const recurso = segmentos[segmentos.length - 1] || "RECURSO";

  return `${accionBase} ${recurso.toUpperCase()}`;
}

/**
 * Construir detalles de la acción
 */
function construirDetalle(req, responseData) {
  const metodo = req.method;
  const detalles = [];

  // Incluir información relevante según el método
  switch (metodo) {
    case "POST":
      if (req.body?.nombre) detalles.push(`Nombre: ${req.body.nombre}`);
      if (req.body?.email) detalles.push(`Email: ${req.body.email}`);
      if (req.body?.matricula)
        detalles.push(`Matrícula: ${req.body.matricula}`);
      if (responseData?.mensaje) detalles.push(responseData.mensaje);
      break;

    case "PUT":
    case "PATCH":
      if (req.params.id) detalles.push(`ID: ${req.params.id}`);
      if (responseData?.mensaje) detalles.push(responseData.mensaje);
      break;

    case "DELETE":
      if (req.params.id) detalles.push(`ID eliminado: ${req.params.id}`);
      if (responseData?.mensaje) detalles.push(responseData.mensaje);
      break;

    case "GET":
      if (req.params.id) detalles.push(`ID consultado: ${req.params.id}`);
      else detalles.push("Listado general");
      break;
  }

  // Agregar información del usuario que realizó la acción
  if (req.usuario?.email) {
    detalles.push(`Usuario: ${req.usuario.email}`);
  }

  return detalles.join(" | ") || "Sin detalles adicionales";
}

/**
 * Registrar acción manualmente (para casos especiales)
 */
async function registrarAccionManual(usuarioId, accion, detalle) {
  try {
    if (!usuarioId) return;

    await prisma.bitacora.create({
      data: {
        usuarioId: parseInt(usuarioId),
        accion: accion,
        detalle: detalle || "Sin detalles",
      },
    });
  } catch (error) {
    console.error("Error al registrar acción manual en bitácora:", error);
  }
}

/**
 * Middlewares predefinidos para acciones comunes
 */
const bitacoraCrear = registrarEnBitacora("CREAR");
const bitacoraActualizar = registrarEnBitacora("ACTUALIZAR");
const bitacoraEliminar = registrarEnBitacora("ELIMINAR");
const bitacoraConsultar = registrarEnBitacora("CONSULTAR");
const bitacoraLogin = registrarEnBitacora("INICIO DE SESIÓN");
const bitacoraCargaMasiva = registrarEnBitacora("CARGA MASIVA");

module.exports = {
  registrarEnBitacora,
  registrarAccionManual,
  bitacoraCrear,
  bitacoraActualizar,
  bitacoraEliminar,
  bitacoraConsultar,
  bitacoraLogin,
  bitacoraCargaMasiva,
};
