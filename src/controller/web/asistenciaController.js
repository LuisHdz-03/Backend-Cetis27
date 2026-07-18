const prisma = require("../../config/prisma");
const XLSX = require("xlsx");
const {
  validateBulkRows,
  buildBulkProcessingMessage,
  parseExcelRowsSafe,
} = require("../../utils/bulkLoad");

const estatusValidos = ["PRESENTE", "FALTA", "RETARDO", "JUSTIFICADA"];
const mensajeEstatusValidos =
  "PRESENTE, FALTA, RETARDO, JUSTIFICADA o JUSTIFICADO";

const normalizarTexto = (valor) => String(valor || "").trim();

const normalizarEstatusAsistencia = (valor) => {
  const estatus = normalizarTexto(valor).toUpperCase();

  if (estatus === "JUSTIFICADO") {
    return "JUSTIFICADA";
  }

  if (estatus === "AUSENTE") {
    return "FALTA";
  }

  return estatus;
};

const normalizarFechaLocal = (fecha) => {
  if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) {
    return null;
  }

  return new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    fecha.getDate(),
    12,
    0,
    0,
    0,
  );
};

const parsearFechaAsistencia = (valor) => {
  if (valor === undefined || valor === null || valor === "") {
    return null;
  }

  if (valor instanceof Date) {
    return normalizarFechaLocal(valor);
  }

  if (typeof valor === "number") {
    const partes = XLSX.SSF.parse_date_code(valor);

    if (!partes) {
      return null;
    }

    return new Date(partes.y, partes.m - 1, partes.d, 12, 0, 0, 0);
  }

  const texto = normalizarTexto(valor);
  const matchIso = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (matchIso) {
    const [, year, month, day] = matchIso;
    return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
  }

  return normalizarFechaLocal(new Date(texto));
};

const formatearFechaLocal = (fecha) => {
  const fechaNormalizada = normalizarFechaLocal(fecha);

  if (!fechaNormalizada) {
    return null;
  }

  const year = fechaNormalizada.getFullYear();
  const month = String(fechaNormalizada.getMonth() + 1).padStart(2, "0");
  const day = String(fechaNormalizada.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const construirRangoFechaLocal = (valor) => {
  const fechaBase = parsearFechaAsistencia(valor);

  if (!fechaBase || Number.isNaN(fechaBase.getTime())) {
    return null;
  }

  return {
    inicio: new Date(
      fechaBase.getFullYear(),
      fechaBase.getMonth(),
      fechaBase.getDate(),
      0,
      0,
      0,
      0,
    ),
    fin: new Date(
      fechaBase.getFullYear(),
      fechaBase.getMonth(),
      fechaBase.getDate(),
      23,
      59,
      59,
      999,
    ),
  };
};

const formatearAsistenciaSalida = (asistencia) => ({
  ...asistencia,
  fecha: formatearFechaLocal(asistencia.fecha),
});

const buscarEstudiantePorMatricula = async (matricula) => {
  const texto = normalizarTexto(matricula);
  if (!texto) return null;

  return prisma.estudiante.findFirst({
    where: {
      matricula: {
        equals: texto,
        mode: "insensitive",
      },
    },
    include: {
      grupo: {
        include: {
          especialidad: {
            select: { nombre: true },
          },
        },
      },
    },
  });
};

const resolverClaseParaAsistencia = async ({
  estudiante,
  materiaNombre,
  docenteUsuarioId,
}) => {
  const whereBase = {
    grupoId: estudiante.grupoId,
    periodo: { activo: true },
  };

  if (docenteUsuarioId) {
    whereBase.docente = {
      usuarioId: docenteUsuarioId,
    };
  }

  if (materiaNombre) {
    whereBase.materias = {
      nombre: {
        equals: materiaNombre,
        mode: "insensitive",
      },
    };
  }

  const clases = await prisma.clase.findMany({
    where: whereBase,
    select: { idClase: true },
  });

  if (clases.length === 0) {
    return {
      ok: false,
      error:
        "No se encontro clase activa para el alumno con los filtros proporcionados",
    };
  }

  if (clases.length > 1) {
    return {
      ok: false,
      error:
        "Hay mas de una clase posible. Agrega MATERIA para evitar ambiguedad",
    };
  }

  return { ok: true, claseId: clases[0].idClase };
};

const registrarAsistencia = async (req, res) => {
  try {
    const { fecha, listaAlumnos, listaAsistencias, materia } = req.body;

    const listaFuente = Array.isArray(listaAlumnos)
      ? listaAlumnos
      : Array.isArray(listaAsistencias)
        ? listaAsistencias
        : [];

    if (listaFuente.length === 0) {
      return res.status(400).json({ mensaje: "Faltan datos validos" });
    }

    const materiaNormalizada = normalizarTexto(materia);
    const docenteUsuarioId =
      req.usuario?.rol === "DOCENTE" ? parseInt(req.usuario.id, 10) : null;

    const fechaParaGuardar = fecha
      ? parsearFechaAsistencia(fecha)
      : normalizarFechaLocal(new Date());
    if (isNaN(fechaParaGuardar.getTime())) {
      return res.status(400).json({ mensaje: "Fecha invalida" });
    }

    const datosPaInsertar = [];
    const errores = [];

    for (const item of listaFuente) {
      const estatus = normalizarEstatusAsistencia(item.estatus);
      const matricula = normalizarTexto(item.matricula);

      if (!matricula) {
        errores.push({
          referencia: "N/D",
          error: "Cada registro requiere MATRICULA",
        });
        continue;
      }

      if (!estatusValidos.includes(estatus)) {
        errores.push({
          referencia: matricula,
          error: `Estatus invalido. Usa ${mensajeEstatusValidos}`,
        });
        continue;
      }

      const estudiante = await buscarEstudiantePorMatricula(matricula);
      if (!estudiante || !estudiante.grupoId) {
        errores.push({
          referencia: matricula,
          error: "No se encontro estudiante o no tiene grupo asignado",
        });
        continue;
      }

      const claseResuelta = await resolverClaseParaAsistencia({
        estudiante,
        materiaNombre: materiaNormalizada,
        docenteUsuarioId,
      });

      if (!claseResuelta.ok) {
        errores.push({ referencia: matricula, error: claseResuelta.error });
        continue;
      }

      datosPaInsertar.push({
        claseId: claseResuelta.claseId,
        alumnoId: estudiante.idEstudiante,
        estatus,
        fecha: fechaParaGuardar,
      });
    }

    if (datosPaInsertar.length === 0) {
      return res.status(400).json({
        mensaje: "No se pudo registrar ninguna asistencia",
        errores,
      });
    }

    const resultado = await prisma.asistencia.createMany({
      data: datosPaInsertar,
      skipDuplicates: true,
    });

    return res.status(201).json({
      mensaje: "Asistencia registrada correctamente",
      totalRegistros: resultado.count,
      fecha: formatearFechaLocal(fechaParaGuardar),
      errores,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ mensaje: "Error interno al tomar las asistencias" });
  }
};

const getAsisPorFecha = async (req, res) => {
  try {
    const { claseId, fecha } = req.query;

    if (!claseId || !fecha) {
      return res.status(400).json({ error: "Se requiere claseId y fecha." });
    }

    const rangoFecha = construirRangoFechaLocal(fecha);

    if (!rangoFecha) {
      return res.status(400).json({ error: "Fecha invalida. Usa YYYY-MM-DD." });
    }

    const { inicio, fin } = rangoFecha;

    const asistencias = await prisma.asistencia.findMany({
      where: {
        claseId: parseInt(claseId, 10),
        fecha: {
          gte: inicio,
          lte: fin,
        },
      },
      include: {
        alumno: {
          include: {
            usuario: {
              select: {
                nombre: true,
                apellidoPaterno: true,
                apellidoMaterno: true,
              },
            },
          },
        },
      },
      orderBy: {
        alumno: { usuario: { apellidoPaterno: "asc" } },
      },
    });

    return res.json(asistencias.map(formatearAsistenciaSalida));
  } catch (error) {
    return res.status(500).json({ error: "Error al obtener asistencias" });
  }
};

const justificarFalta = async (req, res) => {
  const { idAsistencia } = req.params;
  try {
    const asistencia = await prisma.asistencia.findUnique({
      where: { idAsistencia: parseInt(idAsistencia, 10) },
    });

    if (!asistencia) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    const fechaRegistro = new Date(asistencia.fecha);
    const ahora = new Date();

    const esHoy =
      formatearFechaLocal(fechaRegistro) === formatearFechaLocal(ahora);

    if (!esHoy) {
      return res.status(403).json({
        error: "El tiempo expiro. Solo se puede justificar el mismo dia",
      });
    }

    const actualizado = await prisma.asistencia.update({
      where: { idAsistencia: parseInt(idAsistencia, 10) },
      data: { estatus: "JUSTIFICADA" },
    });

    return res.json({
      mensaje: "Justificacion exitosa",
      registro: formatearAsistenciaSalida(actualizado),
    });
  } catch (error) {
    return res.status(500).json({ error: "Error interno al justificar" });
  }
};

const getHistorialAsistencias = async (req, res) => {
  try {
    const {
      claseId,
      alumnoId,
      fechaInicio,
      fechaFin,
      page = 1,
      limit = 50,
    } = req.query;

    const whereClause = {};
    let hasFilter = false;

    if (claseId) {
      whereClause.claseId = parseInt(claseId, 10);
      hasFilter = true;
    }
    if (alumnoId) {
      whereClause.alumnoId = parseInt(alumnoId, 10);
      hasFilter = true;
    }

    if (fechaInicio || fechaFin) {
      hasFilter = true;
      whereClause.fecha = {};
      if (fechaInicio) {
        const rangoInicio = construirRangoFechaLocal(fechaInicio);
        if (!rangoInicio) {
          return res
            .status(400)
            .json({ error: "fechaInicio invalida. Usa YYYY-MM-DD." });
        }
        whereClause.fecha.gte = rangoInicio.inicio;
      }
      if (fechaFin) {
        const rangoFin = construirRangoFechaLocal(fechaFin);
        if (!rangoFin) {
          return res
            .status(400)
            .json({ error: "fechaFin invalida. Usa YYYY-MM-DD." });
        }
        whereClause.fecha.lte = rangoFin.fin;
      }
    }

    if (!hasFilter) {
      return res.status(400).json({
        error:
          "Debe proporcionar al menos un filtro de búsqueda (claseId, alumnoId o rango de fechas).",
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [historial, totalRegistros] = await Promise.all([
      prisma.asistencia.findMany({
        where: whereClause,
        skip,
        take: parseInt(limit),
        include: {
          alumno: {
            include: {
              usuario: {
                select: {
                  nombre: true,
                  apellidoPaterno: true,
                  apellidoMaterno: true,
                },
              },
            },
          },
          clase: {
            include: {
              materias: true,
            },
          },
        },
        orderBy: [
          { fecha: "desc" },
          { alumno: { usuario: { apellidoPaterno: "asc" } } },
        ],
      }),
      prisma.asistencia.count({ where: whereClause }),
    ]);

    return res.json({
      data: historial.map(formatearAsistenciaSalida),
      pagination: {
        totalRegistros,
        totalPages: Math.ceil(totalRegistros / parseInt(limit)),
        currentPage: parseInt(page),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Error al obtener el historial de asistencias." });
  }
};

const exportarHistorialAsistenciasExcel = async (req, res) => {
  try {
    const { claseId, alumnoId, fechaInicio, fechaFin } = req.query;

    const whereClause = {};
    if (claseId) whereClause.claseId = parseInt(claseId, 10);
    if (alumnoId) whereClause.alumnoId = parseInt(alumnoId, 10);

    if (fechaInicio || fechaFin) {
      whereClause.fecha = {};
      if (fechaInicio) {
        const rangoInicio = construirRangoFechaLocal(fechaInicio);
        if (!rangoInicio) {
          return res
            .status(400)
            .json({ error: "fechaInicio invalida. Usa YYYY-MM-DD." });
        }
        whereClause.fecha.gte = rangoInicio.inicio;
      }
      if (fechaFin) {
        const rangoFin = construirRangoFechaLocal(fechaFin);
        if (!rangoFin) {
          return res
            .status(400)
            .json({ error: "fechaFin invalida. Usa YYYY-MM-DD." });
        }
        whereClause.fecha.lte = rangoFin.fin;
      }
    }

    const historial = await prisma.asistencia.findMany({
      where: whereClause,
      include: {
        alumno: {
          include: {
            usuario: {
              select: {
                nombre: true,
                apellidoPaterno: true,
                apellidoMaterno: true,
              },
            },
          },
        },
        clase: {
          include: {
            materias: true,
          },
        },
      },
      orderBy: [{ fecha: "desc" }],
    });

    const filas = historial.map((registro) => ({
      FECHA: formatearFechaLocal(registro.fecha),
      MATERIA: registro.clase?.materias?.nombre || "",
      ALUMNO_MATRICULA: registro.alumno?.matricula || "",
      ALUMNO_NOMBRE:
        `${registro.alumno?.usuario?.nombre || ""} ${registro.alumno?.usuario?.apellidoPaterno || ""} ${registro.alumno?.usuario?.apellidoMaterno || ""}`.trim(),
      ESTATUS: registro.estatus,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(filas);
    XLSX.utils.book_append_sheet(wb, ws, "Asistencias");

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
    const nombreArchivo = `historial_asistencias_${Date.now()}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${nombreArchivo}"`,
    );

    return res.send(buffer);
  } catch (error) {
    return res.status(500).json({ error: "Error al exportar asistencias" });
  }
};

const descargarPlantillaAsistencias = async (req, res) => {
  try {
    const filasEjemplo = [
      {
        FECHA: "2026-04-07",
        ESTATUS: "PRESENTE",
        MATRICULA: "22603061070031",
        MATERIA: "PROGRAMACION WEB",
      },
      {
        FECHA: "2026-04-07",
        ESTATUS: "FALTA",
        MATRICULA: "22603061070032",
        MATERIA: "PROGRAMACION WEB",
      },
    ];

    const instrucciones = [
      {
        CAMPO: "FECHA",
        DESCRIPCION: "Obligatorio. Formato YYYY-MM-DD",
      },
      {
        CAMPO: "ESTATUS",
        DESCRIPCION: `Obligatorio. ${mensajeEstatusValidos}`,
      },
      {
        CAMPO: "MATRICULA",
        DESCRIPCION: "Obligatorio. Identificador principal del alumno",
      },
      {
        CAMPO: "MATERIA",
        DESCRIPCION:
          "Opcional. Recomendado cuando el alumno tiene mas de una clase activa",
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(filasEjemplo);
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Asistencias");
    const wsInstrucciones = XLSX.utils.json_to_sheet(instrucciones);
    XLSX.utils.book_append_sheet(wb, wsInstrucciones, "Instrucciones");

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="plantilla_asistencias.xlsx"',
    );

    return res.send(buffer);
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Error al generar plantilla de asistencias" });
  }
};

const cargarAsistenciasMasivas = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se subio ningun archivo" });
    }

    const datosExcel = parseExcelRowsSafe(req.file.buffer);

    const validacionCarga = validateBulkRows(datosExcel);
    if (validacionCarga) {
      return res
        .status(validacionCarga.status)
        .json({ ok: false, error: validacionCarga.error });
    }

    const errores = [];
    const registrosNuevos = [];
    const usuarioId = parseInt(req.usuario?.id, 10);
    const docenteUsuarioId = req.usuario?.rol === "DOCENTE" ? usuarioId : null;

    for (let i = 0; i < datosExcel.length; i++) {
      const fila = datosExcel[i];
      const numeroFila = i + 2;

      const matricula = normalizarTexto(fila["MATRICULA"]);
      const materiaNombre = normalizarTexto(fila["MATERIA"]);
      const fecha = parsearFechaAsistencia(fila["FECHA"]);
      const estatus = normalizarEstatusAsistencia(fila["ESTATUS"]);

      if (!fecha || !estatus || !matricula) {
        errores.push({
          fila: numeroFila,
          error: "Faltan columnas obligatorias (FECHA, ESTATUS, MATRICULA)",
        });
        continue;
      }

      if (isNaN(fecha.getTime())) {
        errores.push({
          fila: numeroFila,
          error: "Fecha invalida. Usa formato YYYY-MM-DD",
        });
        continue;
      }

      if (!estatusValidos.includes(estatus)) {
        errores.push({
          fila: numeroFila,
          error: `Estatus invalido '${estatus}'. Usa ${mensajeEstatusValidos}`,
        });
        continue;
      }

      const estudiante = await buscarEstudiantePorMatricula(matricula);
      if (!estudiante || !estudiante.grupoId) {
        errores.push({
          fila: numeroFila,
          error: "No se encontro alumno con esa MATRICULA",
        });
        continue;
      }

      const claseResuelta = await resolverClaseParaAsistencia({
        estudiante,
        materiaNombre,
        docenteUsuarioId,
      });

      if (!claseResuelta.ok) {
        errores.push({
          fila: numeroFila,
          error: claseResuelta.error,
        });
        continue;
      }

      registrosNuevos.push({
        claseId: claseResuelta.claseId,
        alumnoId: estudiante.idEstudiante,
        fecha,
        estatus,
      });
    }

    if (registrosNuevos.length > 0) {
      await prisma.asistencia.createMany({
        data: registrosNuevos,
        skipDuplicates: true,
      });
    }

    return res.json({
      ok: true,
      mensaje: "Carga masiva de asistencias finalizada",
      resultadoProcesamiento: buildBulkProcessingMessage(
        registrosNuevos.length,
        errores.length,
      ),
      insertados: registrosNuevos.length,
      fallidos: errores.length,
      detalles: errores,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Error interno al cargar asistencias" });
  }
};

module.exports = {
  registrarAsistencia,
  getAsisPorFecha,
  justificarFalta,
  getHistorialAsistencias,
  exportarHistorialAsistenciasExcel,
  descargarPlantillaAsistencias,
  cargarAsistenciasMasivas,
};
