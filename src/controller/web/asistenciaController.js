const prisma = require("../../config/prisma");
const XLSX = require("xlsx");

const estatusValidos = ["PRESENTE", "AUSENTE", "RETARDO", "JUSTIFICADA"];

const normalizarTexto = (valor) => String(valor || "").trim();

const resolverClaseParaAsistencia = async ({
  estudiante,
  materiaNombre,
  periodoNombre,
  docenteNumeroEmpleado,
}) => {
  const whereBase = {
    grupoId: estudiante.grupoId,
    materias: {
      nombre: {
        equals: materiaNombre,
        mode: "insensitive",
      },
    },
  };

  if (docenteNumeroEmpleado) {
    whereBase.docente = {
      numeroEmpleado: {
        equals: docenteNumeroEmpleado,
        mode: "insensitive",
      },
    };
  }

  if (periodoNombre) {
    whereBase.periodo = {
      nombre: {
        equals: periodoNombre,
        mode: "insensitive",
      },
    };
  } else {
    whereBase.periodo = { activo: true };
  }

  const clases = await prisma.clase.findMany({
    where: whereBase,
    select: {
      idClase: true,
      docente: { select: { numeroEmpleado: true } },
      periodo: { select: { nombre: true, activo: true } },
    },
  });

  if (clases.length === 0) {
    return {
      ok: false,
      error:
        "No se encontró clase para el alumno/materia con los filtros proporcionados",
    };
  }

  if (clases.length > 1) {
    return {
      ok: false,
      error:
        "Hay más de una clase posible. Agrega DOCENTE_NUM_EMPLEADO y/o PERIODO para evitar ambigüedad",
    };
  }

  return { ok: true, claseId: clases[0].idClase };
};

const registrarAsistencia = async (req, res) => {
  try {
    const { claseId, fecha, listaAlumnos, metodo } = req.body;

    if (!claseId || !listaAlumnos || listaAlumnos.length === 0) {
      return res.status(400).json({ mensaje: "Faltan datos válidos" });
    }

    let fechaParaGuardar;

    if (fecha) {
      // EDICIÓN: Si el frontend manda una fecha, significa que el profesor está editando.
      fechaParaGuardar = new Date(fecha);

      // Borramos los registros exactos de esa fecha/hora para reemplazarlos
      await prisma.asistencia.deleteMany({
        where: {
          claseId: parseInt(claseId),
          fecha: fechaParaGuardar,
        },
      });
    } else {
      // NUEVA: Si el frontend NO manda fecha, es un pase de lista 100% nuevo
      fechaParaGuardar = new Date();
    }

    const datosPaInsertar = listaAlumnos.map((alumno) => ({
      claseId: parseInt(claseId),
      alumnoId: parseInt(alumno.alumnoId),
      estatus: alumno.estatus.toUpperCase(),
      fecha: fechaParaGuardar,
    }));

    const resultado = await prisma.asistencia.createMany({
      data: datosPaInsertar,
      skipDuplicates: true,
    });

    res.status(201).json({
      mensaje: fecha
        ? "Asistencia actualizada correctamente"
        : "Asistencia registrada correctamente",
      totalRegistros: resultado.count,
      fecha: fechaParaGuardar.toISOString(),
    });
  } catch (error) {
    console.error("Error al tomar las asistencias:", error);
    res.status(500).json({ mensaje: "Error interno al tomar las asistencias" });
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
        claseId: parseInt(claseId),
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
    res.json(asistencias);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener asistencias " });
  }
};

const justificarFalta = async (req, res) => {
  const { idAsistencia } = req.params;
  try {
    const asistencia = await prisma.asistencia.findUnique({
      where: { idAsistencia: parseInt(idAsistencia) },
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
      where: { idAsistencia: parseInt(idAsistencia) },
      data: { estatus: "JUSTIFICADA" },
    });

    res.json({ mensaje: "Justificacion exitosa", registro: actualizado });
  } catch (error) {
    res.status(500).json({ error: "error interno al justificar" });
  }
};

const getHistorialAsistencias = async (req, res) => {
  try {
    const { claseId, alumnoId, fechaInicio, fechaFin } = req.query;

    let whereClause = {};

    if (claseId) {
      whereClause.claseId = parseInt(claseId);
    }

    if (alumnoId) {
      whereClause.alumnoId = parseInt(alumnoId);
    }

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

    res.json(historial);
  } catch (error) {
    console.error("Error al obtener el historial de asistencias:", error);
    res
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
        MATRICULA: "22603061070031",
        MATERIA: "PROGRAMACION WEB",
        GRUPO: "4A",
        GRADO: 4,
        TURNO: "MATUTINO",
        ESPECIALIDAD: "PROGRAMACION",
        DOCENTE_NUM_EMPLEADO: "DOC001",
        PERIODO: "ENERO-JULIO 2026",
        FECHA: "2026-04-07",
        ESTATUS: "PRESENTE",
      },
      {
        MATRICULA: "22603061070032",
        MATERIA: "PROGRAMACION WEB",
        GRUPO: "4A",
        GRADO: 4,
        TURNO: "MATUTINO",
        ESPECIALIDAD: "PROGRAMACION",
        DOCENTE_NUM_EMPLEADO: "DOC001",
        PERIODO: "ENERO-JULIO 2026",
        FECHA: "2026-04-07",
        ESTATUS: "AUSENTE",
      },
    ];

    const instrucciones = [
      {
        CAMPO: "MATRICULA",
        DESCRIPCION: "Numero de control del alumno (obligatorio)",
      },
      {
        CAMPO: "MATERIA",
        DESCRIPCION: "Nombre exacto de la materia (obligatorio)",
      },
      {
        CAMPO: "GRUPO",
        DESCRIPCION: "Nombre del grupo, ejemplo 4A (opcional)",
      },
      {
        CAMPO: "GRADO",
        DESCRIPCION: "Grado numerico del grupo, ejemplo 4 (opcional)",
      },
      {
        CAMPO: "TURNO",
        DESCRIPCION: "MATUTINO, VESPERTINO o MIXTO (opcional)",
      },
      {
        CAMPO: "ESPECIALIDAD",
        DESCRIPCION: "Nombre de la especialidad del grupo (opcional)",
      },
      {
        CAMPO: "DOCENTE_NUM_EMPLEADO",
        DESCRIPCION: "Numero de empleado del docente (opcional, recomendado)",
      },
      {
        CAMPO: "PERIODO",
        DESCRIPCION: "Nombre del periodo. Si se omite, usa periodo activo",
      },
      {
        CAMPO: "FECHA",
        DESCRIPCION: "Fecha en formato YYYY-MM-DD (obligatorio)",
      },
      {
        CAMPO: "ESTATUS",
        DESCRIPCION: "PRESENTE, AUSENTE, RETARDO o JUSTIFICADA (obligatorio)",
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
    return res
      .status(500)
      .json({ error: "Error al generar plantilla de asistencias" });
  }
};

const cargarAsistenciasMasivas = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se subió ningún archivo" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const datosExcel = XLSX.utils.sheet_to_json(sheet);

    const errores = [];
    const registros = [];

    for (const fila of datosExcel) {
      const matricula = normalizarTexto(fila["MATRICULA"]);
      const materiaNombre = normalizarTexto(fila["MATERIA"]);
      const grupoNombre = normalizarTexto(fila["GRUPO"]);
      const grado = fila["GRADO"] ? parseInt(fila["GRADO"], 10) : null;
      const turno = normalizarTexto(fila["TURNO"]).toUpperCase();
      const especialidadNombre = normalizarTexto(fila["ESPECIALIDAD"]);
      const docenteNumeroEmpleado = normalizarTexto(
        fila["DOCENTE_NUM_EMPLEADO"],
      );
      const periodoNombre = normalizarTexto(fila["PERIODO"]);
      const fecha = fila["FECHA"] ? new Date(fila["FECHA"]) : null;
      const estatus = normalizarTexto(fila["ESTATUS"]).toUpperCase();

      if (!matricula || !materiaNombre || !fecha || !estatus) {
        errores.push({
          fila,
          error:
            "Faltan columnas obligatorias (MATRICULA, MATERIA, FECHA, ESTATUS)",
        });
        continue;
      }

      if (isNaN(fecha.getTime())) {
        errores.push({
          fila,
          error: "Fecha inválida. Usa formato YYYY-MM-DD",
        });
        continue;
      }

      if (!estatusValidos.includes(estatus)) {
        errores.push({
          fila,
          error: `Estatus inválido '${estatus}'. Usa PRESENTE, AUSENTE, RETARDO o JUSTIFICADA`,
        });
        continue;
      }

      if (turno && !["MATUTINO", "VESPERTINO", "MIXTO"].includes(turno)) {
        errores.push({
          fila,
          error: `Turno inválido '${turno}'. Usa MATUTINO, VESPERTINO o MIXTO`,
        });
        continue;
      }

      const estudiante = await prisma.estudiante.findFirst({
        where: {
          matricula: {
            equals: matricula,
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

      if (!estudiante || !estudiante.grupoId || !estudiante.grupo) {
        errores.push({
          fila,
          error:
            "No se encontró alumno con esa matrícula o no tiene grupo asignado",
        });
        continue;
      }

      if (
        grupoNombre &&
        estudiante.grupo.nombre.toUpperCase() !== grupoNombre.toUpperCase()
      ) {
        errores.push({
          fila,
          error: `El grupo '${grupoNombre}' no coincide con el grupo actual del alumno`,
        });
        continue;
      }

      if (grado && estudiante.grupo.grado !== grado) {
        errores.push({
          fila,
          error: `El grado '${grado}' no coincide con el grado actual del alumno`,
        });
        continue;
      }

      if (turno && estudiante.grupo.turno !== turno) {
        errores.push({
          fila,
          error: `El turno '${turno}' no coincide con el turno actual del alumno`,
        });
        continue;
      }

      if (
        especialidadNombre &&
        (estudiante.grupo.especialidad?.nombre || "").toUpperCase() !==
          especialidadNombre.toUpperCase()
      ) {
        errores.push({
          fila,
          error:
            "La especialidad no coincide con la especialidad actual del grupo del alumno",
        });
        continue;
      }

      const claseResuelta = await resolverClaseParaAsistencia({
        estudiante,
        materiaNombre,
        periodoNombre,
        docenteNumeroEmpleado,
      });

      if (!claseResuelta.ok) {
        errores.push({
          fila,
          error: claseResuelta.error,
        });
        continue;
      }

      registros.push({
        claseId: claseResuelta.claseId,
        alumnoId: estudiante.idEstudiante,
        fecha,
        estatus,
      });
    }

    if (registros.length > 0) {
      await prisma.asistencia.createMany({
        data: registros,
        skipDuplicates: true,
      });
    }

    return res.json({
      ok: true,
      mensaje: "Carga masiva de asistencias finalizada",
      insertados: registros.length,
      fallidos: errores.length,
      detalles: errores,
    });
  } catch (error) {
    console.error("Error en carga masiva de asistencias:", error);
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
