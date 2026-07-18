const prisma = require("../../config/prisma");
const XLSX = require("xlsx");
const {
  validateBulkRows,
  buildBulkProcessingMessage,
  buildBulkProcessingFeedback,
  parseExcelRowsSafe,
} = require("../../utils/bulkLoad");

const getExcelValue = (row, aliases = []) => {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(row, alias)) {
      return row[alias];
    }
  }
  return undefined;
};

const parseNullableInt = (value, fieldName) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const parsedValue = parseInt(value, 10);
  if (isNaN(parsedValue)) {
    return { error: `El campo ${fieldName} debe ser un número válido` };
  }

  return parsedValue;
};

const includeMateriaDetalle = {
  especialidad: {
    select: { nombre: true },
  },
  espacio: {
    select: {
      idEspacio: true,
      nombre: true,
      tipo: true,
      activo: true,
    },
  },
};

const resolverEspecialidadId = async (especialidadId) => {
  if (especialidadId === undefined) return undefined;
  if (especialidadId === null || especialidadId === "") return null;

  const parsedEspecialidadId = parseInt(especialidadId, 10);
  if (isNaN(parsedEspecialidadId)) {
    return { error: "El especialidadId es inválido" };
  }

  const especialidadExiste = await prisma.especialidad.findUnique({
    where: { idEspecialidad: parsedEspecialidadId },
    select: { idEspecialidad: true },
  });

  if (!especialidadExiste) {
    return {
      error: `La especialidad con ID ${especialidadId} no existe`,
    };
  }

  return parsedEspecialidadId;
};

const resolverEspacioId = async (espacioId) => {
  if (espacioId === undefined) return undefined;
  if (espacioId === null || espacioId === "") return null;

  const parsedEspacioId = parseInt(espacioId, 10);
  if (isNaN(parsedEspacioId)) {
    return { error: "El espacioId es inválido" };
  }

  const espacioExiste = await prisma.espacio.findFirst({
    where: { idEspacio: parsedEspacioId, activo: true },
    select: { idEspacio: true },
  });

  if (!espacioExiste) {
    return {
      error: `El espacio con ID ${espacioId} no existe o está inactivo`,
    };
  }

  return parsedEspacioId;
};

const resolverEspacioIdPorNombre = async (espacioNombre) => {
  if (!espacioNombre) return null;

  const espacioExiste = await prisma.espacio.findFirst({
    where: {
      nombre: {
        equals: String(espacioNombre).trim(),
        mode: "insensitive",
      },
      activo: true,
    },
    select: { idEspacio: true },
  });

  if (!espacioExiste) {
    return {
      error: `El espacio \"${espacioNombre}\" no existe o está inactivo`,
    };
  }

  return espacioExiste.idEspacio;
};

const crearMateria = async (req, res) => {
  try {
    const {
      nombre,
      codigo,
      horasSemana,
      semestre,
      especialidadId,
      espacioId,
      creditos,
      horasPractica,
      horasTeoria,
    } = req.body;

    const existe = await prisma.materia.findFirst({
      where: { codigo: codigo },
    });

    if (existe) {
      return res.status(400).json({ error: "La materia ya existe" });
    }

    const especialidadResuelta = await resolverEspecialidadId(especialidadId);
    if (especialidadResuelta?.error) {
      return res.status(400).json({ error: especialidadResuelta.error });
    }

    const espacioResuelto = await resolverEspacioId(espacioId);
    if (espacioResuelto?.error) {
      return res.status(400).json({ error: espacioResuelto.error });
    }

    const horasSemanaResueltas = parseNullableInt(horasSemana, "horasSemana");
    if (horasSemanaResueltas?.error) {
      return res.status(400).json({ error: horasSemanaResueltas.error });
    }

    const semestreResuelto = parseNullableInt(semestre, "semestre");
    if (semestreResuelto?.error) {
      return res.status(400).json({ error: semestreResuelto.error });
    }

    const creditosResueltos = parseNullableInt(creditos, "creditos");
    if (creditosResueltos?.error) {
      return res.status(400).json({ error: creditosResueltos.error });
    }

    const horasPracticaResueltas = parseNullableInt(
      horasPractica,
      "horasPractica",
    );
    if (horasPracticaResueltas?.error) {
      return res.status(400).json({ error: horasPracticaResueltas.error });
    }

    const horasTeoriaResueltas = parseNullableInt(horasTeoria, "horasTeoria");
    if (horasTeoriaResueltas?.error) {
      return res.status(400).json({ error: horasTeoriaResueltas.error });
    }

    const nuevaMateria = await prisma.materia.create({
      data: {
        nombre,
        codigo,
        horasSemana: horasSemanaResueltas ?? null,
        semestre: semestreResuelto ?? null,
        especialidadId: especialidadResuelta ?? null,
        espacioId: espacioResuelto ?? null,
        creditos: creditosResueltos ?? null,
        horasPractica: horasPracticaResueltas ?? null,
        horasTeoria: horasTeoriaResueltas ?? null,
      },
      include: includeMateriaDetalle,
    });

    res
      .status(201)
      .json({ mensaje: "Materia nueva creada", materia: nuevaMateria });
  } catch (error) {
    res.status(500).json({ error: "error al crear la materia" });
  }
};

const getMateria = async (req, res) => {
  try {
    const materias = await prisma.materia.findMany({
      include: includeMateriaDetalle,
      orderBy: [
        { especialidad: { nombre: "asc" } },
        { semestre: "asc" },
        { nombre: "asc" },
      ],
    });
    res.json(materias);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener materias" });
  }
};

const actualizarMateria = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      codigo,
      horasSemana,
      semestre,
      especialidadId,
      espacioId,
      creditos,
      horasPractica,
      horasTeoria,
    } = req.body;

    const materiaId = parseInt(id);

    if (isNaN(materiaId)) {
      return res.status(400).json({ error: "ID de materia inválido" });
    }

    // Verificar que la materia existe
    const materiaExiste = await prisma.materia.findUnique({
      where: { idMateria: materiaId },
    });

    if (!materiaExiste) {
      return res.status(404).json({ error: "Materia no encontrada" });
    }

    const especialidadResuelta = await resolverEspecialidadId(especialidadId);
    if (especialidadResuelta?.error) {
      return res.status(400).json({ error: especialidadResuelta.error });
    }

    const espacioResuelto = await resolverEspacioId(espacioId);
    if (espacioResuelto?.error) {
      return res.status(400).json({ error: espacioResuelto.error });
    }

    const horasSemanaResueltas = parseNullableInt(horasSemana, "horasSemana");
    if (horasSemanaResueltas?.error) {
      return res.status(400).json({ error: horasSemanaResueltas.error });
    }

    const semestreResuelto = parseNullableInt(semestre, "semestre");
    if (semestreResuelto?.error) {
      return res.status(400).json({ error: semestreResuelto.error });
    }

    const creditosResueltos = parseNullableInt(creditos, "creditos");
    if (creditosResueltos?.error) {
      return res.status(400).json({ error: creditosResueltos.error });
    }

    const horasPracticaResueltas = parseNullableInt(
      horasPractica,
      "horasPractica",
    );
    if (horasPracticaResueltas?.error) {
      return res.status(400).json({ error: horasPracticaResueltas.error });
    }

    const horasTeoriaResueltas = parseNullableInt(horasTeoria, "horasTeoria");
    if (horasTeoriaResueltas?.error) {
      return res.status(400).json({ error: horasTeoriaResueltas.error });
    }

    // Actualizar materia
    const dataActualizar = {};
    if (nombre !== undefined) dataActualizar.nombre = nombre.trim();
    if (codigo !== undefined)
      dataActualizar.codigo = codigo ? codigo.trim().toUpperCase() : null;
    if (horasSemana !== undefined)
      dataActualizar.horasSemana = horasSemanaResueltas;
    if (semestre !== undefined) dataActualizar.semestre = semestreResuelto;
    if (especialidadId !== undefined)
      dataActualizar.especialidadId = especialidadResuelta;
    if (espacioId !== undefined) dataActualizar.espacioId = espacioResuelto;
    if (creditos !== undefined) dataActualizar.creditos = creditosResueltos;
    if (horasPractica !== undefined)
      dataActualizar.horasPractica = horasPracticaResueltas;
    if (horasTeoria !== undefined)
      dataActualizar.horasTeoria = horasTeoriaResueltas;

    const materiaActualizada = await prisma.materia.update({
      where: { idMateria: materiaId },
      data: dataActualizar,
      include: includeMateriaDetalle,
    });

    res.json({
      mensaje: "Materia actualizada exitosamente",
      materia: materiaActualizada,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(400).json({
        error: "Ya existe una materia con ese código",
      });
    }
    res.status(500).json({ error: "Error al actualizar la materia" });
  }
};

const eliminarMateria = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.materia.delete({
      where: {
        idMateria: parseInt(id),
      },
    });

    res.json({ mensaje: "Materia eliminada correctamente" });
  } catch (error) {
    if (error.code === "P2003") {
      return res.status(400).json({
        error:
          "No se puede eliminar la materia por que esta asisgnada a un grupo",
      });
    }
    res.status(500).json({ error: "Error al eliminar la materia" });
  }
};

const cargarMateriasMasivas = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se subió ningún archivo" });
    }

    const datosExcel = parseExcelRowsSafe(req.file.buffer);

    const [todasLasEspe, todosLosEspacios, todasLasMaterias] =
      await Promise.all([
        prisma.especialidad.findMany({
          select: { idEspecialidad: true, nombre: true },
        }),
        prisma.espacio.findMany({
          where: { activo: true },
          select: { idEspacio: true, nombre: true },
        }),
        prisma.materia.findMany({
          select: {
            idMateria: true,
            nombre: true,
            codigo: true,
            horasSemana: true,
            semestre: true,
            especialidadId: true,
            espacioId: true,
            creditos: true,
            horasPractica: true,
            horasTeoria: true,
          },
        }),
      ]);

    const espeMap = new Map(
      todasLasEspe.map((e) => [
        String(e.nombre).trim().toUpperCase(),
        e.idEspecialidad,
      ]),
    );
    const espMap = new Map(
      todosLosEspacios.map((e) => [
        String(e.nombre).trim().toUpperCase(),
        e.idEspacio,
      ]),
    );
    const matMap = new Map(
      todasLasMaterias.map((m) => [String(m.nombre).trim().toUpperCase(), m]),
    );

    const errores = [];
    const datosInsertados = [];

    for (const fila of datosExcel) {
      const nombre = getExcelValue(fila, ["NOMBRE", "MATERIA"]);
      if (!nombre) {
        errores.push({
          registro: "Desconocido",
          error: "Falta la columna NOMBRE",
        });
        continue;
      }

      try {
        const nombreNorm = String(nombre).trim().toUpperCase();

        const especialidadNombre = getExcelValue(fila, [
          "ESPECIALIDAD",
          "CARRERA",
        ]);
        const especialidadId = especialidadNombre
          ? espeMap.get(String(especialidadNombre).trim().toUpperCase())
          : null;

        const espacioNombre = getExcelValue(fila, ["ESPACIO", "AULA"]);
        const espacioId = espacioNombre
          ? espMap.get(String(espacioNombre).trim().toUpperCase())
          : null;

        const horasInt = parseNullableInt(
          getExcelValue(fila, [
            "HORAS_SEMANA",
            "HORAS SEMANA",
            "HORAS_SEMANALES",
          ]),
          "HORAS_SEMANA",
        );
        const semestreInt = parseNullableInt(
          getExcelValue(fila, ["SEMESTRE"]),
          "SEMESTRE",
        );
        const creditosInt = parseNullableInt(
          getExcelValue(fila, ["CREDITOS", "CRÉDITOS"]),
          "CREDITOS",
        );
        const horasPracticaInt = parseNullableInt(
          getExcelValue(fila, [
            "HORAS_PRACTICA",
            "HORAS PRACTICA",
            "HORAS_PRÁCTICA",
          ]),
          "HORAS_PRACTICA",
        );
        const horasTeoriaInt = parseNullableInt(
          getExcelValue(fila, ["HORAS_TEORIA", "HORAS TEORIA", "HORAS_TEÓRIA"]),
          "HORAS_TEORIA",
        );

        const materiaExiste = matMap.get(nombreNorm);

        if (materiaExiste) {
          const materiaUpdate = {};
          const codigo = getExcelValue(fila, ["CODIGO", "CÓDIGO"]);
          const codNorm = codigo ? String(codigo).trim().toUpperCase() : null;

          if (codNorm !== materiaExiste.codigo) materiaUpdate.codigo = codNorm;
          if (horasInt !== materiaExiste.horasSemana)
            materiaUpdate.horasSemana = horasInt;
          if (semestreInt !== materiaExiste.semestre)
            materiaUpdate.semestre = semestreInt;
          if (especialidadId !== materiaExiste.especialidadId)
            materiaUpdate.especialidadId = especialidadId;
          if (espacioId !== materiaExiste.espacioId)
            materiaUpdate.espacioId = espacioId;

          if (Object.keys(materiaUpdate).length > 0) {
            await prisma.materia.update({
              where: { idMateria: materiaExiste.idMateria },
              data: materiaUpdate,
            });
          }
          datosInsertados.push(nombre);
        } else {
          const nuevaMateria = await prisma.materia.create({
            data: {
              nombre: String(nombre).trim(),
              codigo: getExcelValue(fila, ["CODIGO", "CÓDIGO"])
                ? String(getExcelValue(fila, ["CODIGO", "CÓDIGO"]))
                    .trim()
                    .toUpperCase()
                : null,
              horasSemana: horasInt,
              semestre: semestreInt,
              especialidadId,
              espacioId,
              creditos: creditosInt,
              horasPractica: horasPracticaInt,
              horasTeoria: horasTeoriaInt,
            },
          });
          matMap.set(nombreNorm, nuevaMateria);
          datosInsertados.push(nuevaMateria.nombre);
        }
      } catch (error) {
        errores.push({
          registro: nombre,
          error: error.message || "Error al procesar",
        });
      }
    }

    res.json({
      ok: true,
      mensaje: "Carga masiva finalizada",
      insertados: datosInsertados.length,
      fallidos: errores.length,
      detalles: errores,
    });
  } catch (error) {
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

const getMateriasPorEspecialidad = async (req, res) => {
  try {
    // Tomamos el ID directamente de la URL (params)
    const { especialidadId } = req.params;

    if (isNaN(parseInt(especialidadId))) {
      return res.status(400).json({ error: "ID de especialidad inválido" });
    }

    const materias = await prisma.materia.findMany({
      where: {
        especialidadId: parseInt(especialidadId),
      },
      include: includeMateriaDetalle,
      orderBy: {
        semestre: "asc", // Ordenadas por semestre
      },
    });

    res.json(materias);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error al obtener materias por especialidad" });
  }
};

const descargarPlantillaMaterias = async (req, res) => {
  try {
    const filasEjemplo = [
      {
        NOMBRE: "PROGRAMACION WEB",
        CODIGO: "PRG401",
        "HORAS SEMANA": 5,
        SEMESTRE: 4,
        CREDITOS: 8,
        "HORAS PRACTICA": 3,
        "HORAS TEORIA": 2,
        ESPECIALIDAD: "PROGRAMACION",
        ESPACIO: "LABORATORIO 1",
      },
    ];

    const instrucciones = [
      { CAMPO: "NOMBRE", DESCRIPCION: "Nombre de la materia (obligatorio)" },
      {
        CAMPO: "CODIGO",
        DESCRIPCION: "Código de la materia (opcional, recomendable único)",
      },
      {
        CAMPO: "HORAS SEMANA",
        DESCRIPCION: "Horas por semana (opcional, número entero)",
      },
      {
        CAMPO: "SEMESTRE",
        DESCRIPCION: "Semestre de la materia (opcional, número entero)",
      },
      {
        CAMPO: "CREDITOS",
        DESCRIPCION: "Créditos de la materia (opcional, número entero)",
      },
      {
        CAMPO: "HORAS PRACTICA",
        DESCRIPCION: "Horas prácticas (opcional, número entero)",
      },
      {
        CAMPO: "HORAS TEORIA",
        DESCRIPCION: "Horas teóricas (opcional, número entero)",
      },
      {
        CAMPO: "ESPECIALIDAD",
        DESCRIPCION: "Nombre de la especialidad o carrera existente (opcional)",
      },
      {
        CAMPO: "ESPACIO",
        DESCRIPCION:
          "Nombre del espacio activo existente para la materia (opcional)",
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(filasEjemplo);
    const wsInstrucciones = XLSX.utils.json_to_sheet(instrucciones);
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Materias");
    XLSX.utils.book_append_sheet(wb, wsInstrucciones, "Instrucciones");

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="plantilla_materias.xlsx"',
    );

    return res.send(buffer);
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Error al generar plantilla de materias" });
  }
};

module.exports = {
  crearMateria,
  getMateria,
  actualizarMateria,
  eliminarMateria,
  cargarMateriasMasivas,
  getMateriasPorEspecialidad,
  descargarPlantillaMaterias,
};
