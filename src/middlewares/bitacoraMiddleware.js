const prisma = require("../config/prisma");
const crypto = require("crypto");

const CONSULTA_VENTANA_SEGUNDOS = Number(
  process.env.BITACORA_CONSULTA_WINDOW_SECONDS || 300,
);
const MAX_DETALLE_LENGTH = 1000;

const registrarEnBitacora = (accionBase) => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = function (data) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        registrarAccionEnBitacora(req, accionBase, data, res).catch((error) => {
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
    if (
      !req.usuario ||
      !req.usuario.id ||
      req.method === "GET" ||
      accionBase === "CONSULTAR"
    ) {
      return;
    }

    const accion = construirAccion(req, accionBase);

    const detalle = construirDetalle(req, responseData, null, resObj);

    await prisma.bitacora.create({
      data: {
        usuarioId: parseInt(req.usuario.id),
        accion: accion,
        detalle: detalle,
      },
    });
  } catch (error) {
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

  const accionMetodo = accionesPorMetodo[metodo] || "ACCIÓN";
  return `${accionMetodo} ${extraerRecurso(req)}`;
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

function construirDetalle(
  req,
  responseData,
  firmaConsulta = null,
  resObj = null,
) {
  const metodo = req.method;
  const detalles = [];
  const nombreEntidad = obtenerNombreEntidad(responseData);
  const mensaje = obtenerMensajeBitacora(responseData, metodo, nombreEntidad);

  switch (metodo) {
    case "POST":
      if (mensaje) detalles.push(mensaje);
      break;

    case "PUT":
    case "PATCH":
      if (req.params.id) detalles.push(`ID: ${req.params.id}`);
      if (mensaje) detalles.push(mensaje);
      break;

    case "DELETE":
      if (req.params.id) detalles.push(`ID eliminado: ${req.params.id}`);
      if (responseData?.mensaje) detalles.push(responseData.mensaje);
      break;
  }

  const detalleFinal = detalles.join(" | ") || "Sin detalles adicionales";
  return detalleFinal.slice(0, MAX_DETALLE_LENGTH);
}

function obtenerMensajeBitacora(responseData, metodo, nombreEntidad) {
  let mensaje = responseData?.mensaje;
  if (!mensaje) return "";

  if (responseData.materia && metodo === "POST") {
    mensaje = "Nueva materia registrada";
  } else if (responseData.grupo && ["PUT", "PATCH"].includes(metodo)) {
    mensaje = "Grupo actualizado correctamente";
  }

  const agregarNombre =
    nombreEntidad && ["POST", "PUT", "PATCH"].includes(metodo);
  return agregarNombre ? `${mensaje}: ${nombreEntidad}` : mensaje;
}

function obtenerNombreEntidad(responseData) {
  const estudiante = responseData?.estudiante;
  if (estudiante) {
    const usuario = estudiante.usuario || estudiante;
    const nombreCompleto = [
      usuario.nombre,
      usuario.apellidoPaterno,
      usuario.apellidoMaterno,
    ]
      .filter(Boolean)
      .join(" ");
    if (nombreCompleto) return nombreCompleto;
  }

  const materia = responseData?.materia;
  if (materia?.nombre) return materia.nombre;

  const grupo = responseData?.grupo;
  if (grupo) {
    const grado = Number(grupo.grado);
    const sufijoGrado =
      grado === 1 ? "er" : grado === 2 ? "do" : grado === 3 ? "er" : "to";
    const semestre =
      grupo.grado !== undefined &&
      grupo.grado !== null &&
      Number.isFinite(grado)
        ? `${grado}${sufijoGrado} Semestre`
        : "";
    const especialidad = grupo.especialidad?.nombre || grupo.nombre;
    const descripcion = [semestre, especialidad].filter(Boolean).join(" - ");
    if (descripcion) return descripcion;
  }

  return "";
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
