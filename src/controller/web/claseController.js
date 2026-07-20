const prisma = require("../../config/prisma");
const XLSX = require("xlsx");
const {
  validateBulkRows,
  buildBulkProcessingMessage,
  parseExcelRowsSafe,
} = require("../../utils/bulkLoad");

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
      espacio: {
        select: {
          idEspacio: true,
          nombre: true,
          tipo: true,
          activo: true,
        },
      },
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

const parseIdEntero = (valor) => {
  const numero = parseInt(valor, 10);
  return Number.isNaN(numero) ? null : numero;
};

const obtenerListaClasesEntrada = (body = {}) => {
  let lista =
    body.clases ?? body.materias ?? body.materiasIds ?? body.materiaIds;

  if (lista === undefined) return null;

  if (typeof lista === "string") {
    const texto = lista.trim();

    if (!texto) return [];

    try {
      lista = JSON.parse(texto);
    } catch {
      lista = texto
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return Array.isArray(lista) ? lista : [];
};

const resolverDocenteIdClase = async (
  db,
  claseEntrada,
  docenteTutorId = null,
) => {
  const esObjeto =
    claseEntrada !== null &&
    typeof claseEntrada === "object" &&
    !Array.isArray(claseEntrada);

  let docenteId = esObjeto
    ? parseIdEntero(
        claseEntrada.docenteId ??
          claseEntrada.idDocente ??
          claseEntrada.docente,
      )
    : null;

  if (!docenteId && esObjeto) {
    const docenteUsuarioId = parseIdEntero(
      claseEntrada.docenteUsuarioId ??
        claseEntrada.usuarioDocenteId ??
        claseEntrada.idUsuarioDocente,
    );

    if (docenteUsuarioId) {
      const docente = await db.docente.findUnique({
        where: { usuarioId: docenteUsuarioId },
        select: { idDocente: true },
      });

      if (!docente) {
        const error = new Error(
          `No se encontró docente para el usuario ${docenteUsuarioId}`,
        );
        error.status = 400;
        throw error;
      }

      docenteId = docente.idDocente;
    }
  }

  if (!docenteId) {
    docenteId = docenteTutorId;
  }

  if (!docenteId) {
    const error = new Error("Cada clase debe tener un docente asignado");
    error.status = 400;
    throw error;
  }

  return docenteId;
};

const normalizarClaseEntrada = async (
  db,
  claseEntrada,
  docenteTutorId = null,
) => {
  const esObjeto =
    claseEntrada !== null &&
    typeof claseEntrada === "object" &&
    !Array.isArray(claseEntrada);

  const materiaId = esObjeto
    ? parseIdEntero(
        claseEntrada.materiaId ?? claseEntrada.idMateria ?? claseEntrada.id,
      )
    : parseIdEntero(claseEntrada);

  if (!materiaId) {
    const error = new Error("La lista contiene una materia inválida");
    error.status = 400;
    throw error;
  }

  const docenteId = await resolverDocenteIdClase(
    db,
    claseEntrada,
    docenteTutorId,
  );
  const horarioFueEnviado =
    esObjeto && Object.prototype.hasOwnProperty.call(claseEntrada, "horario");

  return {
    materiaId,
    docenteId,
    horarioFueEnviado,
    horario: horarioFueEnviado ? claseEntrada.horario || null : undefined,
  };
};

const validarClaseUnica = async (
  db,
  { grupoId, materiaId, periodoId, excluirIdClase = null },
) => {
  const claseDuplicada = await db.clase.findFirst({
    where: {
      grupoId,
      materiaId,
      periodoId,
      ...(excluirIdClase ? { idClase: { not: excluirIdClase } } : {}),
    },
    select: { idClase: true },
  });

  if (claseDuplicada) {
    const error = new Error(
      "La materia ya está asignada a ese grupo en el periodo indicado",
    );
    error.status = 400;
    throw error;
  }
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
  if (
    periodoEntrada !== undefined &&
    periodoEntrada !== null &&
    String(periodoEntrada).trim()
  ) {
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
      error: "Grupo ambiguo. Agrega GRADO, TURNO o CARRERA para identificarlo.",
    };
  }

  return grupos[0];
};

const resolverDocenteSinIds = async ({ nombreDocente }) => {
  const textoDocente = normalizarTexto(nombreDocente)
    .replace(/\s+/g, " ")
    .trim();
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
    return (
      nombreCompleto.includes(textoDocente) ||
      textoDocente.includes(nombreCompleto)
    );
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
  const semestreObjetivo = Number.isNaN(gradoNumero)
    ? grupo.grado
    : gradoNumero;

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
  const horaInicio = String(
    fila["HORA INICIO"] || fila["HORA_INICIO"] || "",
  ).trim();
  const horaFin = String(fila["HORA FIN"] || fila["HORA_FIN"] || "").trim();

  if (!dia || !horaInicio || !horaFin) return null;

  return {
    dia: normalizarTexto(dia),
    horaInicio,
    horaFin,
  };
};

const parsearHorarioExistente = (horario) => {
  if (Array.isArray(horario)) {
    return horario
      .map((item) => ({
        dia: normalizarTexto(item?.dia),
        horaInicio: String(item?.horaInicio || "").trim(),
        horaFin: String(item?.horaFin || "").trim(),
      }))
      .filter((item) => item.dia && item.horaInicio && item.horaFin);
  }

  if (typeof horario !== "string") {
    return [];
  }

  return horario
    .split(",")
    .map((segmento) => segmento.trim())
    .filter(Boolean)
    .map((segmento) => {
      const match = segmento.match(/^(.+?)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);

      if (!match) {
        return null;
      }

      return {
        dia: normalizarTexto(match[1]),
        horaInicio: match[2],
        horaFin: match[3],
      };
    })
    .filter(Boolean);
};

const serializarHorario = (horario = [], separador = ", ") => {
  const lista = Array.isArray(horario) ? horario : [];

  return lista
    .map((bloque) => {
      const dia = normalizarTexto(bloque?.dia);
      const horaInicio = String(bloque?.horaInicio || "").trim();
      const horaFin = String(bloque?.horaFin || "").trim();

      if (!dia || !horaInicio || !horaFin) {
        return null;
      }

      return `${dia} ${horaInicio}-${horaFin}`;
    })
    .filter(Boolean)
    .join(separador);
};

const formatearHorarioSalida = (horario) => {
  const bloques = parsearHorarioExistente(horario);

  if (bloques.length === 0) {
    return typeof horario === "string" ? horario : null;
  }

  return serializarHorario(bloques, "\n");
};

const formatearClaseSalida = (clase = {}) => ({
  ...clase,
  horario: formatearHorarioSalida(clase.horario),
});

const existeBloqueHorario = (horario = [], bloque = {}) => {
  const lista = Array.isArray(horario) ? horario : [];

  return lista.some((item) => {
    return (
      normalizarTexto(item.dia) === normalizarTexto(bloque.dia) &&
      String(item.horaInicio || "") === String(bloque.horaInicio || "") &&
      String(item.horaFin || "") === String(bloque.horaFin || "")
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
    const docenteUsuarioId =
      req.body.docenteUsuarioId ?? req.body.usuarioDocenteId;

    if (
      !grupoId ||
      !materiaId ||
      !periodoId ||
      (!docenteIdEntrada && !docenteUsuarioId)
    ) {
      return res.status(400).json({
        error:
          "Faltan datos obligatorios para asignar la clase (grupo, materia, periodo, docente)",
      });
    }

    let docenteIdFinal = docenteIdEntrada
      ? parseInt(docenteIdEntrada, 10)
      : null;

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

    await validarClaseUnica(prisma, {
      grupoId: parseInt(grupoId, 10),
      materiaId: parseInt(materiaId, 10),
      periodoId: parseInt(periodoId, 10),
    });

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

    res.status(201).json({
      mensaje: "Clase creada con éxito",
      clase: formatearClaseSalida(nuevaClase),
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    res.status(500).json({ error: "Error al crear la clase" });
  }
};

const sincronizarClasesGrupo = async (req, res) => {
  try {
    const grupoId = parseIdEntero(req.params.grupoId ?? req.body.grupoId);
    const clasesEntrada = obtenerListaClasesEntrada(req.body);

    if (!grupoId) {
      return res.status(400).json({ error: "grupoId inválido" });
    }

    if (clasesEntrada === null) {
      return res.status(400).json({
        error: "Debes enviar la lista de clases o materias a sincronizar",
      });
    }

    const periodo = await obtenerPeriodoObjetivo(
      req.body.periodoId ?? req.body.idPeriodo,
    );
    if (!periodo) {
      return res.status(400).json({
        error: "No se encontró el periodo indicado ni existe un periodo activo",
      });
    }

    const grupo = await prisma.grupo.findUnique({
      where: { idGrupo: grupoId },
      select: { idGrupo: true, docenteTutorId: true },
    });

    if (!grupo) {
      return res.status(404).json({ error: "Grupo no encontrado" });
    }

    const clasesNormalizadas = [];
    for (const claseEntrada of clasesEntrada) {
      clasesNormalizadas.push(
        await normalizarClaseEntrada(
          prisma,
          claseEntrada,
          grupo.docenteTutorId,
        ),
      );
    }

    const clasesUnicas = new Map();
    for (const clase of clasesNormalizadas) {
      clasesUnicas.set(clase.materiaId, clase);
    }

    const materiasIds = [...clasesUnicas.keys()];
    if (materiasIds.length > 0) {
      const materiasExistentes = await prisma.materia.findMany({
        where: { idMateria: { in: materiasIds } },
        select: { idMateria: true },
      });

      const materiasRegistradas = new Set(
        materiasExistentes.map((materia) => materia.idMateria),
      );

      const faltantes = materiasIds.filter(
        (materiaId) => !materiasRegistradas.has(materiaId),
      );

      if (faltantes.length > 0) {
        return res.status(400).json({
          error: `No existen las materias: ${faltantes.join(", ")}`,
        });
      }
    }

    await prisma.$transaction(async (tx) => {
      const clasesExistentes = await tx.clase.findMany({
        where: { grupoId, periodoId: periodo.idPeriodo },
        select: {
          idClase: true,
          materiaId: true,
          docenteId: true,
          horario: true,
        },
      });

      const clasesPorMateria = new Map();
      for (const clase of clasesExistentes) {
        clasesPorMateria.set(clase.materiaId, clase);
      }

      for (const clase of clasesUnicas.values()) {
        const claseExistente = clasesPorMateria.get(clase.materiaId);

        if (claseExistente) {
          const dataActualizar = {};

          if (claseExistente.docenteId !== clase.docenteId) {
            dataActualizar.docenteId = clase.docenteId;
          }

          if (clase.horarioFueEnviado) {
            dataActualizar.horario = clase.horario;
          }

          if (Object.keys(dataActualizar).length > 0) {
            await tx.clase.update({
              where: { idClase: claseExistente.idClase },
              data: dataActualizar,
            });
          }
          continue;
        }

        await validarClaseUnica(tx, {
          grupoId,
          materiaId: clase.materiaId,
          periodoId: periodo.idPeriodo,
        });

        await tx.clase.create({
          data: {
            grupoId,
            materiaId: clase.materiaId,
            docenteId: clase.docenteId,
            periodoId: periodo.idPeriodo,
            horario: clase.horarioFueEnviado ? clase.horario : null,
          },
        });
      }

      for (const claseExistente of clasesExistentes) {
        if (!clasesUnicas.has(claseExistente.materiaId)) {
          await tx.clase.delete({
            where: { idClase: claseExistente.idClase },
          });
        }
      }
    });

    const clasesActualizadas = await prisma.clase.findMany({
      where: { grupoId, periodoId: periodo.idPeriodo },
      include: includeClaseDetalle,
      orderBy: [{ materias: { nombre: "asc" } }],
    });

    return res.json({
      mensaje: "Clases del grupo sincronizadas correctamente",
      grupoId,
      periodoId: periodo.idPeriodo,
      clases: clasesActualizadas.map(formatearClaseSalida),
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    if (error.code === "P2003") {
      return res.status(400).json({
        error:
          "No se pudieron eliminar algunas clases del grupo porque ya tienen registros relacionados.",
      });
    }
    return res
      .status(500)
      .json({ error: "Error al sincronizar clases del grupo" });
  }
};

const getClase = async (req, res) => {
  try {
    const { busqueda } = req.query;
    const where = {};

    if (busqueda) {
      where.OR = [
        { grupo: { nombre: { contains: busqueda, mode: "insensitive" } } },
        { materias: { nombre: { contains: busqueda, mode: "insensitive" } } },
        {
          docente: {
            usuario: { nombre: { contains: busqueda, mode: "insensitive" } },
          },
        },
        {
          docente: {
            usuario: {
              apellidoPaterno: { contains: busqueda, mode: "insensitive" },
            },
          },
        },
      ];
    }

    const pagina = parseInt(req.query.pagina) || 1;
    const limite = parseInt(req.query.limite) || 20;

    const { docenteId, grupoId, materiaId, buscarMateria } = req.query;

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
      filtro.materias = {
        nombre: { contains: buscarMateria },
      };
    }

    const filtroPeriodo = await resolverFiltroPeriodo(req.query);
    filtro = { ...filtro, ...filtroPeriodo };
    const clases = await prisma.clase.findMany({
      where: filtro,
      skip: (pagina - 1) * limite,
      take: limite,
      include: includeClaseDetalle,
    });

    const totalRegistros = await prisma.clase.count({
      where: filtro,
    });

    res.json({
      data: clases.map(formatearClaseSalida),
      paginacion: {
        totalRegistros,
        paginasTotales: Math.ceil(totalRegistros / limite),
        paginaActual: pagina,
        limite: limite,
      },
    });
  } catch (error) {
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

    res.json(clases.map(formatearClaseSalida));
  } catch (error) {
    res.status(500).json({ error: "No se pudo obtener la carga academica" });
  }
};

const actualizarClase = async (req, res) => {
  try {
    const { id } = req.params;
    const { grupoId, materiaId, docenteId, periodoId, horario } = req.body;
    const docenteUsuarioId =
      req.body.docenteUsuarioId ?? req.body.usuarioDocenteId;

    // Verificar que la clase existe
    const claseExistente = await prisma.clase.findUnique({
      where: { idClase: parseInt(id) },
    });

    if (!claseExistente) {
      return res.status(404).json({ error: "Clase no encontrada" });
    }

    let docenteIdFinal =
      docenteId !== undefined
        ? parseInt(docenteId, 10)
        : claseExistente.docenteId;

    if (
      (Number.isNaN(docenteIdFinal) || !docenteIdFinal) &&
      docenteUsuarioId !== undefined
    ) {
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
      return res.status(400).json({ error: "docenteId inválido" });
    }

    const grupoIdFinal =
      grupoId !== undefined ? parseInt(grupoId, 10) : claseExistente.grupoId;
    const materiaIdFinal =
      materiaId !== undefined
        ? parseInt(materiaId, 10)
        : claseExistente.materiaId;
    const periodoIdFinal =
      periodoId !== undefined
        ? parseInt(periodoId, 10)
        : claseExistente.periodoId;

    await validarClaseUnica(prisma, {
      grupoId: grupoIdFinal,
      materiaId: materiaIdFinal,
      periodoId: periodoIdFinal,
      excluirIdClase: parseInt(id, 10),
    });

    // Construir objeto de datos a actualizar
    const dataActualizar = {};

    if (grupoId !== undefined) {
      dataActualizar.grupoId = parseInt(grupoId);
    }
    if (materiaId !== undefined) {
      dataActualizar.materiaId = parseInt(materiaId);
    }
    if (docenteId !== undefined) {
      dataActualizar.docenteId = docenteIdFinal;
    }
    if (docenteUsuarioId !== undefined) {
      dataActualizar.docenteId = docenteIdFinal;
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
      clase: formatearClaseSalida(claseActualizada),
    });
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar la clase" });
  }
};

const descargarPlantillaHorarios = async (req, res) => {
  try {
    const filasEjemplo = [
      {
        GRUPO: "2AM-Programacion",
        GRADO: 2,
        TURNO: "MATUTINO",
        CARRERA: "PROGRAMACION",
        DOCENTE: "Juan Perez Lopez",
        DIA: "LUNES",
        "HORA INICIO": "07:00",
        "HORA FIN": "07:50",
      },
      {
        GRUPO: "2AM-Programacion",
        GRADO: 2,
        TURNO: "MATUTINO",
        CARRERA: "PROGRAMACION",
        DOCENTE: "Juan Perez Lopez",
        DIA: "MIERCOLES",
        "HORA INICIO": "08:40",
        "HORA FIN": "09:30",
      },
    ];

    const instrucciones = [
      {
        CAMPO: "GRUPO",
        DESCRIPCION: "Nombre del grupo (obligatorio)",
      },
      {
        CAMPO: "GRADO",
        DESCRIPCION:
          "Ayuda a identificar el grupo cuando hay nombres repetidos",
      },
      {
        CAMPO: "TURNO",
        DESCRIPCION: "Ayuda a identificar el grupo (MATUTINO/VESPERTINO/MIXTO)",
      },
      {
        CAMPO: "CARRERA",
        DESCRIPCION: "Nombre o código de la especialidad o carrera",
      },
      {
        CAMPO: "DOCENTE",
        DESCRIPCION: "Nombre completo del docente",
      },
      {
        CAMPO: "DIA, HORA INICIO, HORA FIN",
        DESCRIPCION: "Datos obligatorios de cada bloque horario",
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
    return res
      .status(500)
      .json({ error: "Error al generar plantilla de horarios" });
  }
};

const cargarHorariosMasivos = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "No se subió archivo" });
    }

    const filas = parseExcelRowsSafe(req.file.buffer, { defval: "" });
    const validacionCarga = validateBulkRows(filas);
    if (validacionCarga) {
      return res.status(validacionCarga.status).json({
        ok: false,
        error: validacionCarga.error,
      });
    }

    const errores = [];
    const procesados = [];
    const cacheClases = new Map();

    const periodoActivo = await obtenerPeriodoObjetivo();
    if (!periodoActivo) {
      return res
        .status(400)
        .json({ ok: false, error: "No se encontró periodo activo" });
    }

    const todosLosGrupos = await prisma.grupo.findMany({
      select: {
        idGrupo: true,
        nombre: true,
        grado: true,
        turno: true,
        especialidadId: true,
        especialidad: { select: { nombre: true, codigo: true } },
      },
    });

    const todosLosDocentes = await prisma.docente.findMany({
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

    const todasLasMaterias = await prisma.materia.findMany({
      select: {
        idMateria: true,
        nombre: true,
        especialidadId: true,
        semestre: true,
      },
      orderBy: [{ idMateria: "asc" }],
    });

    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i];
      const numeroFila = i + 2;

      const nombreGrupo = String(
        fila["GRUPO_NOMBRE"] || fila["GRUPO"] || "",
      ).trim();
      const grado = fila["GRADO"];
      const turno = fila["TURNO"];
      const carrera = String(fila["CARRERA"] || "").trim();
      const nombreDocente = String(
        fila["DOCENTE NOMBRE"] ||
          fila["DOCENTE_NOMBRE"] ||
          fila["DOCENTE"] ||
          "",
      ).trim();

      const bloque = construirBloqueHorario(fila);

      if (!nombreGrupo || !nombreDocente || !bloque) {
        errores.push({
          fila: numeroFila,
          error:
            "Faltan datos requeridos: GRUPO, DOCENTE y DIA/HORA INICIO/HORA FIN",
        });
        continue;
      }

      let grupo = null;
      const gruposCoincidentes = todosLosGrupos.filter((g) => {
        let coincide = g.nombre.toUpperCase() === nombreGrupo.toUpperCase();
        if (grado !== undefined && g.grado !== parseInt(grado, 10))
          coincide = false;
        if (turno && g.turno.toUpperCase() !== normalizarTexto(turno))
          coincide = false;
        if (carrera) {
          const carrNorm = normalizarTexto(carrera);
          if (
            normalizarTexto(g.especialidad.nombre) !== carrNorm &&
            normalizarTexto(g.especialidad.codigo) !== carrNorm
          ) {
            coincide = false;
          }
        }
        return coincide;
      });

      if (gruposCoincidentes.length === 0) {
        errores.push({
          fila: numeroFila,
          error: `No existe grupo: ${nombreGrupo}`,
        });
        continue;
      } else if (gruposCoincidentes.length > 1) {
        errores.push({
          fila: numeroFila,
          error:
            "Grupo ambiguo. Agrega GRADO, TURNO o CARRERA para identificarlo.",
        });
        continue;
      } else {
        grupo = gruposCoincidentes[0];
      }

      const textoDocente = normalizarTexto(nombreDocente)
        .replace(/\s+/g, " ")
        .trim();
      let docente = null;

      const docentesCoincidentes = todosLosDocentes.filter((d) => {
        const nombreCompleto = armarNombreCompleto(d.usuario);
        return (
          nombreCompleto.includes(textoDocente) ||
          textoDocente.includes(nombreCompleto)
        );
      });

      if (docentesCoincidentes.length === 0) {
        errores.push({
          fila: numeroFila,
          error: `No existe docente: ${nombreDocente}`,
        });
        continue;
      } else if (docentesCoincidentes.length > 1) {
        errores.push({
          fila: numeroFila,
          error: "Docente ambiguo. Captura el nombre completo del docente.",
        });
        continue;
      } else {
        docente = docentesCoincidentes[0];
      }

      const clasesCandidatas = await prisma.clase.findMany({
        where: {
          grupoId: grupo.idGrupo,
          docenteId: docente.idDocente,
          periodoId: periodoActivo.idPeriodo,
        },
        orderBy: [{ idClase: "asc" }],
        select: { idClase: true, horario: true, materiaId: true },
      });

      let materiaResuelta = null;
      if (clasesCandidatas.length > 0) {
        materiaResuelta = {
          idMateria: clasesCandidatas[0].materiaId,
          nombre: "(resuelta por clase existente)",
        };
      } else {
        const gradoNumero = parseInt(grado, 10);
        const semestreObjetivo = Number.isNaN(gradoNumero)
          ? grupo.grado
          : gradoNumero;

        materiaResuelta = todasLasMaterias.find(
          (m) =>
            m.especialidadId === grupo.especialidadId &&
            m.semestre === semestreObjetivo,
        );
        if (!materiaResuelta) {
          materiaResuelta = todasLasMaterias.find(
            (m) => m.especialidadId === grupo.especialidadId,
          );
        }
      }

      if (!materiaResuelta) {
        errores.push({
          fila: numeroFila,
          error:
            "No se pudo resolver materia automaticamente para el grupo/carrera",
        });
        continue;
      }

      const claveClase = `${grupo.idGrupo}-${materiaResuelta.idMateria}-${docente.idDocente}-${periodoActivo.idPeriodo}`;
      let claseCache = cacheClases.get(claveClase);

      if (!claseCache) {
        let clase = await prisma.clase.findFirst({
          where: {
            grupoId: grupo.idGrupo,
            materiaId: materiaResuelta.idMateria,
            docenteId: docente.idDocente,
            periodoId: periodoActivo.idPeriodo,
          },
          select: { idClase: true, horario: true },
        });

        if (!clase) {
          clase = await prisma.clase.create({
            data: {
              grupoId: grupo.idGrupo,
              materiaId: materiaResuelta.idMateria,
              docenteId: docente.idDocente,
              periodoId: periodoActivo.idPeriodo,
              horario: "",
            },
            select: { idClase: true, horario: true },
          });
        }

        claseCache = {
          idClase: clase.idClase,
          horario: parsearHorarioExistente(clase.horario),
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
        data: { horario: serializarHorario(claseCache.horario) || null },
      });
    }

    return res.json({
      ok: errores.length === 0,
      mensaje: `Carga masiva de horarios finalizada. Procesados: ${procesados.length}. Errores: ${errores.length}`,
      resultadoProcesamiento: buildBulkProcessingMessage(
        procesados.length,
        errores.length,
      ),
      clasesAfectadas: cacheClases.size,
      procesados,
      errores,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ ok: false, error: "Error al cargar horarios masivamente" });
  }
};

module.exports = {
  crearClase,
  sincronizarClasesGrupo,
  getClase,
  getClaseByDocente,
  actualizarClase,
  descargarPlantillaHorarios,
  cargarHorariosMasivos,
};
