const prisma = require("../../config/prisma");
const XLSX = require("xlsx");

const estatusValidos = ["PRESENTE", "AUSENTE", "RETARDO", "JUSTIFICADA"];

const normalizarTexto = (valor) => String(valor || "").trim();

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
      error: "No se encontro clase activa para el alumno con los filtros proporcionados",
    };
  }

  if (clases.length > 1) {
    return {
      ok: false,
      error: "Hay mas de una clase posible. Agrega MATERIA para evitar ambiguedad",
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

    const fechaParaGuardar = fecha ? new Date(fecha) : new Date();
    if (isNaN(fechaParaGuardar.getTime())) {
      return res.status(400).json({ mensaje: "Fecha invalida" });
    }

    const datosPaInsertar = [];
    const errores = [];

    for (const item of listaFuente) {
      const estatus = normalizarTexto(item.estatus).toUpperCase();
      const matricula = normalizarTexto(item.matricula);

      if (!matricula) {
        errores.push({ referencia: "N/D", error: "Cada registro requiere MATRICULA" });
        continue;
      }

      if (!estatusValidos.includes(estatus)) {
        errores.push({
          referencia: matricula,
          error: "Estatus invalido. Usa PRESENTE, AUSENTE, RETARDO o JUSTIFICADA",
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
      fecha: fechaParaGuardar.toISOString(),
      errores,
    });
  } catch (error) {
    console.error("Error al tomar las asistencias:", error);
    return res.status(500).json({ mensaje: "Error interno al tomar las asistencias" });
  }
};

const getAsisPorFecha = async (req, res) => {
  try {
    const { claseId, fecha } = req.query;

    if (!claseId || !fecha) {
      return res.status(400).json({ error: "Se requiere claseId y fecha." });
    }

    const fechaBusqueda = new Date(fecha);
    const inicio = new Date(fechaBusqueda.setHours(0, 0, 0, 0));
    const fin = new Date(fechaBusqueda.setHours(23, 59, 59, 999));

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

    return res.json(asistencias);
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
      fechaRegistro.getDate() === ahora.getDate() &&
      fechaRegistro.getMonth() === ahora.getMonth() &&
      fechaRegistro.getFullYear() === ahora.getFullYear();

    if (!esHoy) {
      return res.status(403).json({
        error: "El tiempo expiro. Solo se puede justificar el mismo dia",
      });
    }

    const actualizado = await prisma.asistencia.update({
      where: { idAsistencia: parseInt(idAsistencia, 10) },
      data: { estatus: "JUSTIFICADA" },
    });

    return res.json({ mensaje: "Justificacion exitosa", registro: actualizado });
  } catch (error) {
    return res.status(500).json({ error: "Error interno al justificar" });
  }
};

const getHistorialAsistencias = async (req, res) => {
  try {
    const { claseId, alumnoId, fechaInicio, fechaFin } = req.query;

    const whereClause = {};

    if (claseId) whereClause.claseId = parseInt(claseId, 10);
    if (alumnoId) whereClause.alumnoId = parseInt(alumnoId, 10);

    if (fechaInicio || fechaFin) {
      whereClause.fecha = {};
      if (fechaInicio) {
        const inicio = new Date(fechaInicio);
        inicio.setHours(0, 0, 0, 0);
        whereClause.fecha.gte = inicio;
      }
      if (fechaFin) {
        const fin = new Date(fechaFin);
        fin.setHours(23, 59, 59, 999);
        whereClause.fecha.lte = fin;
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
      orderBy: [
        { fecha: "desc" },
        { alumno: { usuario: { apellidoPaterno: "asc" } } },
      ],
    });

    return res.json(historial);
  } catch (error) {
    console.error("Error al obtener el historial de asistencias:", error);
    return res.status(500).json({ error: "Error al obtener el historial de asistencias." });
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
        const inicio = new Date(fechaInicio);
        inicio.setHours(0, 0, 0, 0);
        whereClause.fecha.gte = inicio;
      }
      if (fechaFin) {
        const fin = new Date(fechaFin);
        fin.setHours(23, 59, 59, 999);
        whereClause.fecha.lte = fin;
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
      FECHA: registro.fecha.toISOString(),
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
    console.error("Error al exportar asistencias:", error);
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
        ESTATUS: "AUSENTE",
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
        DESCRIPCION: "Obligatorio. PRESENTE, AUSENTE, RETARDO o JUSTIFICADA",
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
    console.error("Error al generar plantilla de asistencias:", error);
    return res.status(500).json({ error: "Error al generar plantilla de asistencias" });
  }
};

const cargarAsistenciasMasivas = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se subio ningun archivo" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const datosExcel = XLSX.utils.sheet_to_json(sheet);

    const errores = [];
    const registrosNuevos = [];
    const usuarioId = parseInt(req.usuario?.id, 10);
    const docenteUsuarioId = req.usuario?.rol === "DOCENTE" ? usuarioId : null;

    for (let i = 0; i < datosExcel.length; i++) {
      const fila = datosExcel[i];
      const numeroFila = i + 2;

      const matricula = normalizarTexto(fila["MATRICULA"]);
      const materiaNombre = normalizarTexto(fila["MATERIA"]);
      const fecha = fila["FECHA"] ? new Date(fila["FECHA"]) : null;
      const estatus = normalizarTexto(fila["ESTATUS"]).toUpperCase();

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
          error: `Estatus invalido '${estatus}'. Usa PRESENTE, AUSENTE, RETARDO o JUSTIFICADA`,
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
      insertados: registrosNuevos.length,
      fallidos: errores.length,
      detalles: errores,
    });
  } catch (error) {
    console.error("Error en carga masiva de asistencias:", error);
    return res.status(500).json({ error: "Error interno al cargar asistencias" });
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
