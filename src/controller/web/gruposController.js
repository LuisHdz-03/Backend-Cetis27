const prisma = require("../../config/prisma");
const XLSX = require("xlsx");
const {
  validateBulkRows,
  buildBulkProcessingMessage,
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

const validarAulaEnCatalogo = async (aula) => {
  if (!aula) return true;

  const espacio = await prisma.espacio.findFirst({
    where: {
      nombre: {
        equals: String(aula).trim(),
        mode: "insensitive",
      },
      activo: true,
    },
  });

  return Boolean(espacio);
};

const crearGrupo = async (req, res) => {
  try {
    const { nombre, grado, turno, aula, especialidadId, docenteTutorId } =
      req.body;

    // Validaciones
    if (!especialidadId) {
      return res.status(400).json({ error: "Falta ID de la Especialidad" });
    }

    if (!docenteTutorId) {
      return res
        .status(400)
        .json({ error: "Falta ID del Docente Tutor del grupo" });
    }

    if (aula) {
      const aulaValida = await validarAulaEnCatalogo(aula);
      if (!aulaValida) {
        return res.status(400).json({
          error:
            "El aula/espacio enviado no existe en el catálogo activo. Regístralo primero en el apartado de espacios.",
        });
      }
    }

    const nuevoGrupo = await prisma.grupo.create({
      data: {
        nombre,
        grado: parseInt(grado),
        turno,
        aula,
        especialidadId: parseInt(especialidadId),
        docenteTutorId: parseInt(docenteTutorId),
      },
      include: {
        docenteTutor: {
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
    });

    res
      .status(201)
      .json({ mensaje: "Grupo creado exitosamente", grupo: nuevoGrupo });
  } catch (error) {
    res.status(500).json({ error: "Error al crear grupo" });
  }
};

const getGrupos = async (req, res) => {
  try {
    const where = { activo: true };

    const grupos = await prisma.grupo.findMany({
      where,
      include: {
        especialidad: {
          select: { nombre: true, codigo: true },
        },
        docenteTutor: {
          include: {
            usuario: {
              select: {
                nombre: true,
                apellidoPaterno: true,
                apellidoMaterno: true,
                username: true,
              },
            },
          },
        },
        clases: {
          where: { periodo: { activo: true } },
          include: {
            materias: {
              include: {
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
              include: {
                usuario: {
                  select: {
                    nombre: true,
                    apellidoPaterno: true,
                  },
                },
              },
            },
            periodo: {
              select: {
                nombre: true,
                activo: true,
              },
            },
          },
        },
        _count: {
          select: {
            estudiantes: true,
          },
        },
      },
      orderBy: {
        grado: "asc",
      },
    });

    res.json(grupos);
  } catch (error) {
    res.status(500).json({
      error: "Error al obtener grupos",
    });
  }
};

const getGrupoById = async (req, res) => {
  const { id } = req.params;
  try {
    const grupo = await prisma.grupo.findUnique({
      where: { idGrupo: parseInt(id) },
      include: {
        estudiantes: {
          include: {
            usuario: {
              select: {
                nombre: true,
                apellidoPaterno: true,
                apellidoMaterno: true,
              },
            },
          },
          orderBy: { usuario: { apellidoPaterno: "asc" } },
        },
        especialidad: true,
        docenteTutor: {
          include: {
            usuario: {
              select: {
                nombre: true,
                apellidoPaterno: true,
                apellidoMaterno: true,
                username: true,
              },
            },
          },
        },
        clases: {
          where: { periodo: { activo: true } },
          include: {
            materias: {
              include: {
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
            periodo: true,
            docente: {
              include: {
                usuario: { select: { nombre: true, apellidoPaterno: true } },
              },
            },
          },
        },
      },
    });
    if (!grupo) return res.status(404).json({ error: "Grupo no encontrado" });
    res.json(grupo);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener detalle del grupo" });
  }
};

const actualizarGrupo = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, grado, turno, aula, especialidadId, docenteTutorId } =
      req.body;

    const grupoId = parseInt(id, 10);
    if (isNaN(grupoId)) {
      return res.status(400).json({ error: "ID de grupo inválido" });
    }

    if (grado !== undefined && isNaN(parseInt(grado, 10))) {
      return res
        .status(400)
        .json({ error: "El grado debe ser un número válido" });
    }

    if (especialidadId !== undefined) {
      if (especialidadId === null || isNaN(parseInt(especialidadId, 10))) {
        return res
          .status(400)
          .json({ error: "El especialidadId es inválido o no puede ser nulo" });
      }
    }

    let parsedDocenteTutorId = null;
    if (docenteTutorId !== undefined && docenteTutorId !== null) {
      parsedDocenteTutorId = parseInt(docenteTutorId, 10);
      if (isNaN(parsedDocenteTutorId))
        return res.status(400).json({ error: "docenteTutorId inválido" });
    }

    const grupoExiste = await prisma.grupo.findUnique({
      where: { idGrupo: grupoId },
    });
    if (!grupoExiste) {
      return res.status(404).json({ error: "Grupo no encontrado" });
    }

    const turnosValidos = ["MATUTINO", "VESPERTINO", "MIXTO"];
    if (turno !== undefined) {
      const turnoNormalizado = String(turno).trim().toUpperCase();
      if (!turnosValidos.includes(turnoNormalizado)) {
        return res.status(400).json({
          error: `Turno inválido. Debe ser MATUTINO, VESPERTINO o MIXTO`,
        });
      }
    }

    if (especialidadId !== undefined && especialidadId !== null) {
      const esp = await prisma.especialidad.findUnique({
        where: { idEspecialidad: parseInt(especialidadId, 10) },
      });
      if (!esp) {
        return res.status(400).json({ error: "La especialidad no existe" });
      }
    }

    if (aula !== undefined && aula !== null && String(aula).trim() !== "") {
      const aulaValida = await validarAulaEnCatalogo(aula);
      if (!aulaValida) {
        return res.status(400).json({
          error:
            "El aula/espacio enviado no existe en el catálogo activo. Regístralo primero en el apartado de espacios.",
        });
      }
    }

    const dataActualizar = {};
    if (nombre !== undefined) dataActualizar.nombre = String(nombre).trim();
    if (grado !== undefined) dataActualizar.grado = parseInt(grado, 10);
    if (turno !== undefined)
      dataActualizar.turno = String(turno).trim().toUpperCase();
    if (aula !== undefined)
      dataActualizar.aula = aula ? String(aula).trim() : null;
    if (especialidadId !== undefined)
      dataActualizar.especialidadId = parseInt(especialidadId, 10);
    if (parsedDocenteTutorId !== null)
      dataActualizar.docenteTutorId = parsedDocenteTutorId;

    const grupoActualizado = await prisma.grupo.update({
      where: { idGrupo: grupoId },
      data: dataActualizar,
      include: {
        docenteTutor: {
          include: {
            usuario: {
              select: {
                nombre: true,
                apellidoPaterno: true,
                apellidoMaterno: true,
                username: true,
              },
            },
          },
        },
        especialidad: {
          select: { nombre: true, codigo: true },
        },
      },
    });

    return res.json({
      mensaje: "Grupo actualizado exitosamente",
      grupo: grupoActualizado,
    });
  } catch (error) {
    return res.status(500).json({ error: "Error al actualizar el grupo" });
  }
};

// no se elimina por seguridad, solo se pone en false
const eliminarGrupo = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.grupo.update({
      where: { idGrupo: parseInt(id) },
      data: { activo: false },
    });

    res.json({ mensaje: "Grupo eliminado correctamente" });
  } catch (error) {
    if (error.code === "P2003") {
      return res.status(400).json({
        error: "No se puede eliminar el grupo por que hay alumnos asignados",
      });
    }
    res.status(500).json({ error: "Error al eliminar el grupo" });
  }
};

const cargarGruposMasivos = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se subió ningún archivo" });
    }

    const datosExcel = parseExcelRowsSafe(req.file.buffer);

    const validacionCarga = validateBulkRows(datosExcel);
    if (validacionCarga) {
      return res
        .status(validacionCarga.status)
        .json({ ok: false, error: validacionCarga.error });
    }

    const errores = [];
    const datosInsertados = [];
    const turnosValidos = ["MATUTINO", "VESPERTINO", "MIXTO"];

    // 1. Aulas activas
    const espacios = await prisma.espacio.findMany({
      where: { activo: true },
      select: { nombre: true },
    });
    const aulasSet = new Set(
      espacios.map((e) => String(e.nombre).trim().toUpperCase()),
    );

    // 2. Especialidades
    const especialidades = await prisma.especialidad.findMany({
      select: { idEspecialidad: true, nombre: true },
    });
    const especialidadesMap = new Map(
      especialidades.map((e) => [
        String(e.nombre).trim().toUpperCase(),
        e.idEspecialidad,
      ]),
    );

    // 3. Docentes
    const docentes = await prisma.docente.findMany({
      select: { idDocente: true, numeroEmpleado: true },
    });
    const docentesMap = new Map(
      docentes.map((d) => [
        String(d.numeroEmpleado).trim().toUpperCase(),
        d.idDocente,
      ]),
    );

    // 4. Grupos existentes
    const gruposExistentes = await prisma.grupo.findMany({
      select: {
        idGrupo: true,
        nombre: true,
        grado: true,
        especialidadId: true,
        turno: true,
        aula: true,
        docenteTutorId: true,
      },
    });

    for (const fila of datosExcel) {
      const nombre = getExcelValue(fila, ["NOMBRE", "GRUPO"]);
      const grado = getExcelValue(fila, ["GRADO", "SEMESTRE"]);
      const turno = getExcelValue(fila, ["TURNO"]);
      const aula = getExcelValue(fila, ["AULA", "ESPACIO"]);
      const especialidadNombre = getExcelValue(fila, [
        "ESPECIALIDAD",
        "CARRERA",
      ]);
      const docenteTutorNumEmpleado = getExcelValue(fila, [
        "DOCENTE TUTOR",
        "DOCENTE_TUTOR_NUM_EMPLEADO",
        "DOCENTE_TUTOR",
        "DOCENTE_TUTOR_NUMERO_EMPLEADO",
      ]);

      if (!nombre || !grado || !turno || !especialidadNombre) {
        errores.push({
          registro: nombre || "Desconocido",
          error: "Faltan columnas (NOMBRE, GRADO, TURNO o ESPECIALIDAD)",
        });
        continue;
      }

      if (!docenteTutorNumEmpleado) {
        errores.push({
          registro: nombre || "Desconocido",
          error: "Falta la columna DOCENTE TUTOR (obligatoria)",
        });
        continue;
      }

      const turnoNormalizado = String(turno).trim().toUpperCase();
      if (!turnosValidos.includes(turnoNormalizado)) {
        errores.push({
          registro: nombre,
          error: `Turno inválido: ${turno}. Debe ser MATUTINO, VESPERTINO o MIXTO`,
        });
        continue;
      }

      if (aula) {
        if (!aulasSet.has(String(aula).trim().toUpperCase())) {
          errores.push({
            registro: nombre,
            error: `El aula/espacio '${aula}' no existe en el catálogo activo`,
          });
          continue;
        }
      }

      const idEspecialidad = especialidadesMap.get(
        String(especialidadNombre).trim().toUpperCase(),
      );
      if (!idEspecialidad) {
        errores.push({
          registro: nombre,
          error: `La especialidad "${especialidadNombre}" no existe`,
        });
        continue;
      }

      const idDocenteTutor = docentesMap.get(
        String(docenteTutorNumEmpleado).trim().toUpperCase(),
      );
      if (!idDocenteTutor) {
        errores.push({
          registro: nombre,
          error: `No existe docente tutor con número de empleado '${docenteTutorNumEmpleado}'`,
        });
        continue;
      }

      try {
        const gradoInt = parseInt(grado);
        const grupoExistente = gruposExistentes.find(
          (g) =>
            g.nombre === String(nombre).trim() &&
            g.grado === gradoInt &&
            g.especialidadId === idEspecialidad,
        );

        if (grupoExistente) {
          const grupoUpdate = {};
          if (turnoNormalizado !== grupoExistente.turno)
            grupoUpdate.turno = turnoNormalizado;
          if ((aula ? String(aula).trim() : null) !== grupoExistente.aula)
            grupoUpdate.aula = aula ? String(aula).trim() : null;
          if (grupoExistente.docenteTutorId !== idDocenteTutor)
            grupoUpdate.docenteTutorId = idDocenteTutor;

          if (Object.keys(grupoUpdate).length > 0) {
            await prisma.grupo.update({
              where: { idGrupo: grupoExistente.idGrupo },
              data: grupoUpdate,
            });
          }
          datosInsertados.push(nombre);
        } else {
          await prisma.grupo.create({
            data: {
              nombre: String(nombre).trim(),
              grado: gradoInt,
              turno: turnoNormalizado,
              aula: aula ? String(aula).trim() : null,
              especialidadId: idEspecialidad,
              docenteTutorId: idDocenteTutor,
            },
          });
          datosInsertados.push(String(nombre).trim());
        }
      } catch (error) {
        errores.push({
          registro: nombre,
          error: error.message || "Error al guardar el grupo",
        });
      }
    }

    res.json({
      ok: true,
      mensaje: "Carga masiva finalizada",
      resultadoProcesamiento: buildBulkProcessingMessage(
        datosInsertados.length,
        errores.length,
      ),
      insertados: datosInsertados.length,
      fallidos: errores.length,
      detalles: errores,
    });
  } catch (error) {
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

const descargarPlantillaGrupos = async (req, res) => {
  try {
    const filasEjemplo = [
      {
        NOMBRE: "4A",
        GRADO: 4,
        TURNO: "MATUTINO",
        AULA: "A-101",
        ESPECIALIDAD: "PROGRAMACION",
        "DOCENTE TUTOR": "DOC001",
      },
    ];

    const instrucciones = [
      { CAMPO: "NOMBRE", DESCRIPCION: "Nombre del grupo (obligatorio)" },
      {
        CAMPO: "GRADO",
        DESCRIPCION: "Grado del grupo en numero (obligatorio)",
      },
      {
        CAMPO: "TURNO",
        DESCRIPCION: "MATUTINO, VESPERTINO o MIXTO (obligatorio)",
      },
      {
        CAMPO: "AULA",
        DESCRIPCION:
          "Nombre del aula/espacio (debe existir en catálogo de espacios activos)",
      },
      {
        CAMPO: "ESPECIALIDAD",
        DESCRIPCION: "Nombre de la especialidad (obligatorio)",
      },
      {
        CAMPO: "DOCENTE TUTOR",
        DESCRIPCION:
          "Numero de empleado del docente tutor (obligatorio, sin ID)",
      },
    ];

    const wb = XLSX.utils.book_new();
    const wsEjemplo = XLSX.utils.json_to_sheet(filasEjemplo);
    const wsInstrucciones = XLSX.utils.json_to_sheet(instrucciones);
    XLSX.utils.book_append_sheet(wb, wsEjemplo, "Plantilla_Grupos");
    XLSX.utils.book_append_sheet(wb, wsInstrucciones, "Instrucciones");

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="plantilla_grupos.xlsx"',
    );

    return res.send(buffer);
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Error al generar plantilla de grupos" });
  }
};

module.exports = {
  crearGrupo,
  getGrupos,
  getGrupoById,
  actualizarGrupo,
  eliminarGrupo,
  cargarGruposMasivos,
  descargarPlantillaGrupos,
};
