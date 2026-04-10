const prisma = require("../../config/prisma");
const XLSX = require("xlsx");

const includeClaseDetalle = {
  grupo: {
    select: {
      idGrupo: true,
      nombre: true,
      grado: true,
      turno: true,
      especialidad: {
        select: {
          nombre: true,
          codigo: true,
        },
      },
    },
  },
  materias: {
    select: {
      idMateria: true,
      nombre: true,
      codigo: true,
    },
  },
  docente: {
    select: {
      idDocente: true,
      usuarioId: true,
      usuario: {
        select: {
          idUsuario: true,
          nombre: true,
          apellidoPaterno: true,
          apellidoMaterno: true,
        },
      },
    },
  },
  periodo: {
    select: {
      idPeriodo: true,
      nombre: true,
      fechaInicio: true,
      fechaFin: true,
    },
  },
};

const normalizarTexto = (valor) =>
  String(valor || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const armarNombreCompleto = (usuario = {}) => {
  return normalizarTexto(
    `${usuario.nombre || ""} ${usuario.apellidoPaterno || ""} ${usuario.apellidoMaterno || ""}`,
  )
    .replace(/\s+/g, " ")
    .trim();
};

const obtenerPeriodoObjetivo = async (periodoEntrada) => {
  if (periodoEntrada !== undefined && periodoEntrada !== null && String(periodoEntrada).trim()) {
    const valor = String(periodoEntrada).trim();
    const posibleId = parseInt(valor, 10);

    if (!Number.isNaN(posibleId)) {
      return prisma.periodo.findUnique({ where: { idPeriodo: posibleId } });
    }

    return prisma.periodo.findFirst({
      where: {
        OR: [
          { nombre: { equals: valor, mode: "insensitive" } },
          { codigo: { equals: valor, mode: "insensitive" } },
        ],
      },
    });
  }

  return prisma.periodo.findFirst({ where: { activo: true } });
};

const resolverGrupoSinIds = async ({ nombreGrupo, grado, turno, carrera }) => {
  const where = {
    nombre: { equals: String(nombreGrupo || "").trim(), mode: "insensitive" },
  };

  if (grado !== undefined && grado !== null && String(grado).trim()) {
    const gradoNumero = parseInt(grado, 10);
    if (!Number.isNaN(gradoNumero)) {
      where.grado = gradoNumero;
    }
  }

  if (turno !== undefined && turno !== null && String(turno).trim()) {
    where.turno = normalizarTexto(turno);
  }

  if (carrera && String(carrera).trim()) {
    const carreraNormalizada = String(carrera).trim();
    where.especialidad = {
      OR: [
        { nombre: { equals: carreraNormalizada, mode: "insensitive" } },
        { codigo: { equals: carreraNormalizada, mode: "insensitive" } },
      ],
    };
  }

  const grupos = await prisma.grupo.findMany({
    where,
    select: {
      idGrupo: true,
      nombre: true,
      grado: true,
      turno: true,
      especialidadId: true,
      especialidad: {
        select: {
          nombre: true,
          codigo: true,
        },
      },
    },
  });

  if (grupos.length === 0) return null;
  if (grupos.length > 1) {
    return {
      error:
        "Grupo ambiguo. Agrega GRADO, TURNO o CARRERA para identificarlo.",
    };
  }

  return grupos[0];
};

const resolverDocenteSinIds = async ({ nombreDocente }) => {
  const textoDocente = normalizarTexto(nombreDocente).replace(/\s+/g, " ").trim();
  if (!textoDocente) return null;

  const docentes = await prisma.docente.findMany({
    include: {
      usuario: {
        select: {
          idUsuario: true,
          nombre: true,
          apellidoPaterno: true,
          apellidoMaterno: true,
        },
      },
    },
  });

  const coincidencias = docentes.filter((d) => {
    const nombreCompleto = armarNombreCompleto(d.usuario);
    return nombreCompleto.includes(textoDocente) || textoDocente.includes(nombreCompleto);
  });

  if (coincidencias.length === 0) return null;
  if (coincidencias.length > 1) {
    return {
      error:
        "Docente ambiguo. Captura el nombre completo del docente para identificarlo.",
    };
  }

  return coincidencias[0];
};

const resolverMateriaPorGrupo = async ({ grupo, grado }) => {
  const gradoNumero = parseInt(grado, 10);
  const semestreObjetivo = Number.isNaN(gradoNumero) ? grupo.grado : gradoNumero;

  let materia = await prisma.materia.findFirst({
    where: {
      especialidadId: grupo.especialidadId,
      semestre: semestreObjetivo,
    },
    orderBy: [{ idMateria: "asc" }],
    select: { idMateria: true, nombre: true },
  });

  if (!materia) {
    materia = await prisma.materia.findFirst({
      where: {
        especialidadId: grupo.especialidadId,
      },
      orderBy: [{ idMateria: "asc" }],
      select: { idMateria: true, nombre: true },
    });
  }

  return materia;
};

const construirBloqueHorario = (fila) => {
  const dia = String(fila["DIA"] || "").trim();
  const horaInicio = String(fila["HORA_INICIO"] || "").trim();
  const horaFin = String(fila["HORA_FIN"] || "").trim();
  const espacio = String(fila["ESPACIO"] || "").trim();

  if (!dia || !horaInicio || !horaFin) return null;

  return {
    dia: normalizarTexto(dia),
    horaInicio,
    horaFin,
    espacio: espacio || null,
  };
};

const existeBloqueHorario = (horario = [], bloque = {}) => {
  const lista = Array.isArray(horario) ? horario : [];

  return lista.some((item) => {
    return (
      normalizarTexto(item.dia) === normalizarTexto(bloque.dia) &&
      String(item.horaInicio || "") === String(bloque.horaInicio || "") &&
      String(item.horaFin || "") === String(bloque.horaFin || "") &&
      String(item.espacio || "") === String(bloque.espacio || "")
    );
  });
};

const resolverFiltroPeriodo = async (query = {}) => {
  const { periodoId, incluirHistorico } = query;

  if (periodoId) {
    return { periodoId: parseInt(periodoId) };
  }

  if (String(incluirHistorico).toLowerCase() === "true") {
    return {};
  }

  const periodoActivo = await prisma.periodo.findFirst({
    where: { activo: true },
    select: { idPeriodo: true },
  });

  if (!periodoActivo) {
    return {};
  }

  return { periodoId: periodoActivo.idPeriodo };
};

const crearClase = async (req, res) => {
  try {
    const { grupoId, materiaId, periodoId, horario } = req.body;
    const docenteIdEntrada = req.body.docenteId ?? req.body.idDocente;
    const docenteUsuarioId = req.body.docenteUsuarioId ?? req.body.usuarioDocenteId;

    if (!grupoId || !materiaId || !periodoId || (!docenteIdEntrada && !docenteUsuarioId)) {
      return res
        .status(400)
        .json({
          error:
            "Faltan datos obligatorios para asignar la clase (grupo, materia, periodo, docente)",
        });
    }

    let docenteIdFinal = docenteIdEntrada ? parseInt(docenteIdEntrada, 10) : null;

    if ((!docenteIdFinal || Number.isNaN(docenteIdFinal)) && docenteUsuarioId) {
      const docente = await prisma.docente.findUnique({
        where: { usuarioId: parseInt(docenteUsuarioId, 10) },
        select: { idDocente: true },
      });

      if (!docente) {
        return res.status(404).json({
          error: "No se encontró docente para el usuario proporcionado",
        });
      }

      docenteIdFinal = docente.idDocente;
    }

    if (!docenteIdFinal || Number.isNaN(docenteIdFinal)) {
      return res.status(400).json({
        error: "docenteId inválido",
      });
    }

    const nuevaClase = await prisma.clase.create({
      data: {
        horario: horario || null,
        grupo: {
          connect: { idGrupo: parseInt(grupoId) },
        },
        materias: {
          connect: { idMateria: parseInt(materiaId) },
        },
        docente: {
          connect: { idDocente: docenteIdFinal },
        },
        periodo: {
          connect: { idPeriodo: parseInt(periodoId) },
        },
      },
      include: includeClaseDetalle,
    });

    res
      .status(201)
      .json({ mensaje: "Clase creada con éxito", clase: nuevaClase });
  } catch (error) {
    console.error("Error crítico al crear la clase:", error);
    res.status(500).json({ error: "Error al crear la clase" });
  }
};

const getClase = async (req, res) => {
  try {
    // 1. Recibimos parámetros de la URL (si no mandan, se usan valores por defecto)
    const pagina = parseInt(req.query.pagina) || 1;
    const limite = parseInt(req.query.limite) || 50;

    // Filtros opcionales
    const { docenteId, grupoId, materiaId, buscarMateria } = req.query;

    // 2. Armamos el objeto dinámico de filtros (empezamos vacío)
    let filtro = {};

    if (docenteId) {
      filtro.docenteId = parseInt(docenteId);
    }
    if (grupoId) {
      filtro.grupoId = parseInt(grupoId);
    }
    if (materiaId) {
      filtro.materiaId = parseInt(materiaId);
    }
    if (buscarMateria) {
      // Para buscar materias escribiendo un pedazo del nombre
      filtro.materias = {
        nombre: { contains: buscarMateria },
      };
    }

    const filtroPeriodo = await resolverFiltroPeriodo(req.query);
    filtro = { ...filtro, ...filtroPeriodo };

    // 3. Ejecutamos la consulta a Prisma con Paginación y Filtros
    const clases = await prisma.clase.findMany({
      where: filtro,
      skip: (pagina - 1) * limite,
      take: limite,
      include: includeClaseDetalle,
    });

    // 4. Contamos cuántos registros hay en total para la paginación del frontend
    const totalRegistros = await prisma.clase.count({
      where: filtro,
    });

    // 5. Mandamos la respuesta estructurada
    res.json({
      data: clases,
      paginacion: {
        totalRegistros,
        paginasTotales: Math.ceil(totalRegistros / limite),
        paginaActual: pagina,
        limite: limite,
      },
    });
  } catch (error) {
    console.error("Error al traer clases:", error);
    res.status(500).json({ error: "No se pudieron traer las clases" });
  }
};

const getClaseByDocente = async (req, res) => {
  const { idDocente } = req.params;
  const idSolicitado = parseInt(idDocente, 10);

  try {
    if (req.usuario?.rol === "DOCENTE" && req.usuario?.id !== idSolicitado) {
      return res.status(403).json({
        error: "Solo puedes consultar tu propia carga academica",
      });
    }

    const docente = await prisma.docente.findUnique({
      where: { usuarioId: idSolicitado },
    });

    if (!docente) {
      return res.status(404).json({
        error: "No se encontró un perfil de docente para este usuario",
      });
    }

    const filtroPeriodo = await resolverFiltroPeriodo(req.query);

    const clases = await prisma.clase.findMany({
      where: { docenteId: docente.idDocente, ...filtroPeriodo },
      include: includeClaseDetalle,
    });

    res.json(clases);
  } catch (error) {
    console.error("Error al obtener carga académica:", error);
    res.status(500).json({ error: "No se pudo obtener la carga academica" });
  }
};

const actualizarClase = async (req, res) => {
  try {
    const { id } = req.params;
    const { grupoId, materiaId, docenteId, periodoId, horario } = req.body;

    // Verificar que la clase existe
    const claseExistente = await prisma.clase.findUnique({
      where: { idClase: parseInt(id) },
    });

    if (!claseExistente) {
      return res.status(404).json({ error: "Clase no encontrada" });
    }

    // Construir objeto de datos a actualizar
    const dataActualizar = {};

    if (grupoId !== undefined) {
      dataActualizar.grupoId = parseInt(grupoId);
    }
    if (materiaId !== undefined) {
      dataActualizar.materiaId = parseInt(materiaId);
    }
    if (docenteId !== undefined) {
      dataActualizar.docenteId = parseInt(docenteId);
    }
    if (periodoId !== undefined) {
      dataActualizar.periodoId = parseInt(periodoId);
    }
    if (horario !== undefined) {
      dataActualizar.horario = horario;
    }

    // Actualizar la clase
    const claseActualizada = await prisma.clase.update({
      where: { idClase: parseInt(id) },
      data: dataActualizar,
      include: includeClaseDetalle,
    });

    res.json({
      mensaje: "Clase actualizada correctamente",
      clase: claseActualizada,
    });
  } catch (error) {
    console.error("Error al actualizar clase:", error);
    res.status(500).json({ error: "Error al actualizar la clase" });
  }
};

const descargarPlantillaHorarios = async (req, res) => {
  try {
    const filasEjemplo = [
      {
        GRUPO_NOMBRE: "2AM-Programacion",
        GRADO: 2,
        TURNO: "MATUTINO",
        CARRERA: "PROGRAMACION",
        DOCENTE_NOMBRE: "Juan Perez Lopez",
        DIA: "LUNES",
        HORA_INICIO: "07:00",
        HORA_FIN: "07:50",
        ESPACIO: "LABORATORIO 1",
      },
      {
        GRUPO_NOMBRE: "2AM-Programacion",
        GRADO: 2,
        TURNO: "MATUTINO",
        CARRERA: "PROGRAMACION",
        DOCENTE_NOMBRE: "Juan Perez Lopez",
        DIA: "MIERCOLES",
        HORA_INICIO: "08:40",
        HORA_FIN: "09:30",
        ESPACIO: "AULA B-12",
      },
    ];

    const instrucciones = [
      {
        CAMPO: "GRUPO_NOMBRE",
        DESCRIPCION: "Mapea a grupoId (obligatorio, se resuelve por nombre)",
      },
      {
        CAMPO: "GRADO",
        DESCRIPCION: "Ayuda a desambiguar grupo para obtener grupoId",
      },
      {
        CAMPO: "TURNO",
        DESCRIPCION: "Ayuda a desambiguar grupo para obtener grupoId (MATUTINO/VESPERTINO/MIXTO)",
      },
      {
        CAMPO: "CARRERA",
        DESCRIPCION: "Nombre o código de especialidad para resolver grupoId/materiaId",
      },
      {
        CAMPO: "DOCENTE_NOMBRE",
        DESCRIPCION: "Mapea a docenteId resolviendo por nombre completo",
      },
      {
        CAMPO: "DIA, HORA_INICIO, HORA_FIN",
        DESCRIPCION: "Mapea al campo horario (JSON) y es obligatorio por bloque",
      },
      {
        CAMPO: "ESPACIO",
        DESCRIPCION: "Opcional. Ejemplo: AULA B-12 o LABORATORIO 1",
      },
      {
        CAMPO: "NOTA",
        DESCRIPCION:
          "Periodo se toma automaticamente del periodo activo. materiaId se resuelve en backend segun grupo/carrera.",
      },
    ];

    const wb = XLSX.utils.book_new();
    const wsEjemplo = XLSX.utils.json_to_sheet(filasEjemplo);
    const wsInstrucciones = XLSX.utils.json_to_sheet(instrucciones);

    XLSX.utils.book_append_sheet(wb, wsEjemplo, "Plantilla_Horarios");
    XLSX.utils.book_append_sheet(wb, wsInstrucciones, "Instrucciones");

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="plantilla_horarios.xlsx"',
    );

    return res.send(buffer);
  } catch (error) {
    console.error("Error al generar plantilla de horarios:", error);
    return res.status(500).json({ error: "Error al generar plantilla de horarios" });
  }
};

const cargarHorariosMasivos = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "No se subió archivo" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (!Array.isArray(filas) || filas.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "El archivo no contiene filas para procesar",
      });
    }

    const errores = [];
    const procesados = [];
    const cacheClases = new Map();

    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i];
      const numeroFila = i + 2;

      const nombreGrupo = String(fila["GRUPO_NOMBRE"] || fila["GRUPO"] || "").trim();
      const grado = fila["GRADO"];
      const turno = fila["TURNO"];
      const carrera = String(fila["CARRERA"] || "").trim();
      const nombreDocente = String(fila["DOCENTE_NOMBRE"] || fila["DOCENTE"] || "").trim();

      const bloque = construirBloqueHorario(fila);

      if (!nombreGrupo || !nombreDocente || !bloque) {
        errores.push({
          fila: numeroFila,
          error:
            "Faltan datos requeridos: GRUPO_NOMBRE, DOCENTE_NOMBRE y DIA/HORA_INICIO/HORA_FIN",
        });
        continue;
      }

      const grupo = await resolverGrupoSinIds({ nombreGrupo, grado, turno, carrera });
      if (!grupo) {
        errores.push({ fila: numeroFila, error: `No existe grupo: ${nombreGrupo}` });
        continue;
      }
      if (grupo.error) {
        errores.push({ fila: numeroFila, error: grupo.error });
        continue;
      }

      const docente = await resolverDocenteSinIds({
        nombreDocente,
      });
      if (!docente) {
        errores.push({ fila: numeroFila, error: `No existe docente: ${nombreDocente}` });
        continue;
      }
      if (docente.error) {
        errores.push({ fila: numeroFila, error: docente.error });
        continue;
      }

      const periodo = await obtenerPeriodoObjetivo();

      if (!periodo) {
        errores.push({
          fila: numeroFila,
          error: "No se encontró periodo activo",
        });
        continue;
      }

      const clasesCandidatas = await prisma.clase.findMany({
        where: {
          grupoId: grupo.idGrupo,
          docenteId: docente.idDocente,
          periodoId: periodo.idPeriodo,
        },
        orderBy: [{ idClase: "asc" }],
        select: { idClase: true, horario: true, materiaId: true },
      });

      let materiaResuelta = null;
      if (clasesCandidatas.length > 0) {
        materiaResuelta = { idMateria: clasesCandidatas[0].materiaId, nombre: "(resuelta por clase existente)" };
      } else {
        materiaResuelta = await resolverMateriaPorGrupo({ grupo, grado });
      }

      if (!materiaResuelta) {
        errores.push({
          fila: numeroFila,
          error:
            "No se pudo resolver materia automaticamente para el grupo/carrera",
        });
        continue;
      }

      const claveClase = `${grupo.idGrupo}-${materiaResuelta.idMateria}-${docente.idDocente}-${periodo.idPeriodo}`;
      let claseCache = cacheClases.get(claveClase);

      if (!claseCache) {
        let clase = await prisma.clase.findFirst({
          where: {
            grupoId: grupo.idGrupo,
            materiaId: materiaResuelta.idMateria,
            docenteId: docente.idDocente,
            periodoId: periodo.idPeriodo,
          },
          select: { idClase: true, horario: true },
        });

        if (!clase) {
          clase = await prisma.clase.create({
            data: {
              grupoId: grupo.idGrupo,
              materiaId: materiaResuelta.idMateria,
              docenteId: docente.idDocente,
              periodoId: periodo.idPeriodo,
              horario: [],
            },
            select: { idClase: true, horario: true },
          });
        }

        claseCache = {
          idClase: clase.idClase,
          horario: Array.isArray(clase.horario) ? [...clase.horario] : [],
        };
        cacheClases.set(claveClase, claseCache);
      }

      if (!existeBloqueHorario(claseCache.horario, bloque)) {
        claseCache.horario.push(bloque);
      }

      procesados.push({
        fila: numeroFila,
        grupo: nombreGrupo,
        carrera: grupo.especialidad?.nombre || carrera || null,
        docente: armarNombreCompleto(docente.usuario),
        bloque,
      });
    }

    for (const claseCache of cacheClases.values()) {
      await prisma.clase.update({
        where: { idClase: claseCache.idClase },
        data: { horario: claseCache.horario },
      });
    }

    return res.json({
      ok: errores.length === 0,
      mensaje: `Carga masiva de horarios finalizada. Procesados: ${procesados.length}. Errores: ${errores.length}`,
      clasesAfectadas: cacheClases.size,
      procesados,
      errores,
    });
  } catch (error) {
    console.error("Error en carga masiva de horarios:", error);
    return res
      .status(500)
      .json({ ok: false, error: "Error al cargar horarios masivamente" });
  }
};

module.exports = {
  crearClase,
  getClase,
  getClaseByDocente,
  actualizarClase,
  descargarPlantillaHorarios,
  cargarHorariosMasivos,
};
