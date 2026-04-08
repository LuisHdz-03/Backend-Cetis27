const prisma = require("../config/prisma");
const crypto = require("crypto");

const CONSULTA_VENTANA_SEGUNDOS = Number(
  process.env.BITACORA_CONSULTA_WINDOW_SECONDS || 300,
);
const MAX_DETALLE_LENGTH = 1000;
const CAMPOS_SENSIBLES = [
  "password",
  "passwordactual",
  "passwordnueva",
  "passwordconfirmar",
  "token",
  "authorization",
  "resetpasswordtokenhash",
  "x-layout-sync-key",
  "curp",
];

const registrarEnBitacora = (accionBase) => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = function (data) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        registrarAccionEnBitacora(req, accionBase, data, res).catch((error) => {
          console.error("Error al registrar en bitácora:", error);
        });
      }
      return originalJson(data);
    };

    next();
  };
};

async function registrarAccionEnBitacora(
  req,
  accionBase,
  responseData,
  resObj,
) {
  try {
    if (!req.usuario || !req.usuario.id) {
      return;
    }

    const accion = construirAccion(req, accionBase);

    const firmaConsulta = accion.startsWith("CONSULTAR")
      ? construirFirmaConsulta(req)
      : null;

    if (firmaConsulta) {
      const umbral = new Date(Date.now() - CONSULTA_VENTANA_SEGUNDOS * 1000);
      const yaExiste = await prisma.bitacora.findFirst({
        where: {
          usuarioId: parseInt(req.usuario.id),
          accion: { startsWith: "CONSULTAR" },
          fecha: { gte: umbral },
          detalle: { contains: `RefConsulta:${firmaConsulta}` },
        },
        select: { idBitacora: true },
      });

      if (yaExiste) {
        return;
      }
    }

    const detalle = construirDetalle(req, responseData, firmaConsulta, resObj);

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

function construirAccion(req, accionBase) {
  if (accionBase) {
    const accionesConRecurso = [
      "CREAR",
      "ACTUALIZAR",
      "ELIMINAR",
      "CONSULTAR",
      "CARGA MASIVA",
    ];

    if (accionesConRecurso.includes(accionBase)) {
      return `${accionBase} ${extraerRecurso(req)}`;
    }

    return accionBase;
  }

  const metodo = req.method;

  const accionesPorMetodo = {
    POST: "CREAR",
    PUT: "ACTUALIZAR",
    PATCH: "ACTUALIZAR",
    DELETE: "ELIMINAR",
    GET: "CONSULTAR",
  };

  const accionBase = accionesPorMetodo[metodo] || "ACCIÓN";
  return `${accionBase} ${extraerRecurso(req)}`;
}

function extraerRecurso(req) {
  const ruta = req.route?.path || req.path || "";
  const segmentos = ruta.split("/").filter((s) => s && !s.startsWith(":"));
  return (segmentos[segmentos.length - 1] || "RECURSO").toUpperCase();
}

function obtenerRutaCompleta(req) {
  const base = req.baseUrl || "";
  const ruta = req.route?.path || req.path || "";
  return `${base}${ruta}` || req.originalUrl || "N/D";
}

function obtenerIpCliente(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return String(forwarded).split(",")[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || "N/D";
}

function normalizarObjeto(valor) {
  if (!valor || typeof valor !== "object") return valor;
  if (Array.isArray(valor)) {
    return valor.map((item) => normalizarObjeto(item));
  }

  return Object.keys(valor)
    .sort()
    .reduce((acc, key) => {
      acc[key] = normalizarObjeto(valor[key]);
      return acc;
    }, {});
}

function construirFirmaConsulta(req) {
  const base = {
    metodo: req.method,
    ruta: obtenerRutaCompleta(req),
    query: normalizarObjeto(req.query || {}),
    params: normalizarObjeto(req.params || {}),
    usuarioId: req.usuario?.id || null,
  };

  const serializado = JSON.stringify(base);
  return crypto
    .createHash("sha1")
    .update(serializado)
    .digest("hex")
    .slice(0, 16);
}

function limpiarCamposSensibles(body = {}) {
  const llaves = Object.keys(body || {});
  return llaves.filter(
    (key) => !CAMPOS_SENSIBLES.includes(String(key).toLowerCase()),
  );
}

function construirDetalle(
  req,
  responseData,
  firmaConsulta = null,
  resObj = null,
) {
  const metodo = req.method;
  const detalles = [];

  const ip = obtenerIpCliente(req);
  const ruta = obtenerRutaCompleta(req);
  const userAgent = String(req.headers["user-agent"] || "N/D").slice(0, 140);

  detalles.push(`Metodo: ${metodo}`);
  detalles.push(`Ruta: ${ruta}`);
  detalles.push(
    `Status: ${resObj?.statusCode || req.res?.statusCode || "N/D"}`,
  );
  detalles.push(`IP: ${ip}`);
  detalles.push(`UA: ${userAgent}`);
  if (req.usuario?.id)
    detalles.push(`Actor: ID ${req.usuario.id} (${req.usuario.rol || "N/D"})`);

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
      else detalles.push("Listado/consulta");
      if (req.query && Object.keys(req.query).length > 0) {
        detalles.push(
          `Filtros: ${JSON.stringify(normalizarObjeto(req.query))}`,
        );
      }
      break;
  }

  const camposEditados = limpiarCamposSensibles(req.body);
  if (["POST", "PUT", "PATCH"].includes(metodo) && camposEditados.length > 0) {
    detalles.push(`Campos: ${camposEditados.slice(0, 12).join(", ")}`);
  }

  if (firmaConsulta) {
    detalles.push(`RefConsulta:${firmaConsulta}`);
  }

  const detalleFinal = detalles.join(" | ") || "Sin detalles adicionales";
  return detalleFinal.slice(0, MAX_DETALLE_LENGTH);
}

async function registrarAccionManual(usuarioId, accion, detalle) {
  try {
    if (!usuarioId) return;

    await prisma.bitacora.create({
      data: {
        usuarioId: parseInt(usuarioId),
        accion: accion,
        detalle: String(detalle || "Sin detalles").slice(0, MAX_DETALLE_LENGTH),
      },
    });
  } catch (error) {
    console.error("Error al registrar acción manual en bitácora:", error);
  }
}

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
