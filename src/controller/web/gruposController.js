const prisma = require("../../config/prisma");
const XLSX = require("xlsx");

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
    const {
      nombre,
      grado,
      turno,
      aula,
      periodoId, // Este lo conservamos SOLO para crear las clases, no el grupo
      especialidadId,
      docenteId,
      docenteTutorId,
      materiasIds,
    } = req.body;

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

    const nuevoGrupo = await prisma.$transaction(async (tx) => {
      const grupoCreado = await tx.grupo.create({
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

      if (
        docenteId &&
        materiasIds &&
        Array.isArray(materiasIds) &&
        materiasIds.length > 0 &&
        periodoId // Ahora nos aseguramos que haya un periodoId para crear la clase
      ) {
        const clasesData = materiasIds.map((materiaId) => ({
          grupoId: grupoCreado.idGrupo,
          docenteId: parseInt(docenteId),
          materiaId: parseInt(materiaId),
          periodoId: parseInt(periodoId),
        }));

        await tx.clase.createMany({
          data: clasesData,
        });
      }

      return grupoCreado;
    });

    res
      .status(201)
      .json({ mensaje: "Grupo creado exitosamente", grupo: nuevoGrupo });
  } catch (error) {
    console.error("Error al crear grupo con materias:", error);
    res.status(500).json({ error: "Error al crear grupo" });
  }
};

const getGrupos = async (req, res) => {
  try {
    const grupos = await prisma.grupo.findMany({
      where: {
        activo: true,
      },
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
          include: {
            materias: true,
            docente: {
              include: {
                usuario: { select: { nombre: true, apellidoPaterno: true } },
              },
            },
            periodo: {
              select: { nombre: true, activo: true },
            },
          },
        },
        _count: {
          select: { estudiantes: true },
        },
      },
      orderBy: {
        grado: "asc",
      },
    });
    res.json(grupos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener grupos" });
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
          include: {
            materias: true,
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
    const {
      nombre,
      grado,
      turno,
      aula,
      especialidadId,
      periodoId,
      docenteId,
      docenteTutorId,
      materiasIds,
    } = req.body;

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

    let parsedDocenteId = null;
    if (docenteId !== undefined && docenteId !== null) {
      parsedDocenteId = parseInt(docenteId, 10);
      if (isNaN(parsedDocenteId))
        return res.status(400).json({ error: "docenteId inválido" });
    }

    let parsedPeriodoId = null;
    if (periodoId !== undefined && periodoId !== null) {
      parsedPeriodoId = parseInt(periodoId, 10);
      if (isNaN(parsedPeriodoId))
        return res.status(400).json({ error: "periodoId inválido" });
    }

    let parsedDocenteTutorId = null;
    if (docenteTutorId !== undefined && docenteTutorId !== null) {
      parsedDocenteTutorId = parseInt(docenteTutorId, 10);
      if (isNaN(parsedDocenteTutorId))
        return res.status(400).json({ error: "docenteTutorId inválido" });
    }

    let parsedMateriasIds = [];
    if (materiasIds !== undefined) {
      if (!Array.isArray(materiasIds)) {
        return res
          .status(400)
          .json({ error: "materiasIds debe ser un arreglo" });
      }
      parsedMateriasIds = materiasIds.map((m) => parseInt(m, 10));
      if (parsedMateriasIds.some(isNaN)) {
        return res
          .status(400)
          .json({ error: "Uno o más IDs en materiasIds no son válidos" });
      }

      if (
        parsedMateriasIds.length > 0 &&
        (!parsedDocenteId || !parsedPeriodoId)
      ) {
        return res.status(400).json({
          error:
            "Para asignar materias, debes enviar un docenteId y periodoId válidos.",
        });
      }
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

    const grupoActualizado = await prisma.$transaction(async (tx) => {
      const grupo = await tx.grupo.update({
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

      if (materiasIds !== undefined && Array.isArray(materiasIds)) {
        // Limpiamos las clases actuales del grupo
        await tx.clase.deleteMany({ where: { grupoId } });

        if (parsedMateriasIds.length > 0) {
          const clasesData = parsedMateriasIds.map((materiaId) => ({
            grupoId,
            docenteId: parsedDocenteId,
            materiaId: materiaId,
            periodoId: parsedPeriodoId,
          }));
          await tx.clase.createMany({ data: clasesData });
        }
      }

      return grupo;
    });

    return res.json({
      mensaje: "Grupo actualizado exitosamente",
      grupo: grupoActualizado,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al actualizar el grupo" });
  }
};

const eliminarGrupo = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.grupo.delete({
      where: { idGrupo: parseInt(id) },
    });
    res.json({ mensaje: "Grupo eliminado correctamente" });
  } catch (error) {
    console.error(error);
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

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const datosExcel = XLSX.utils.sheet_to_json(sheet);

    const errores = [];
    const datosInsertados = [];

    const turnosValidos = ["MATUTINO", "VESPERTINO", "MIXTO"];

    for (const fila of datosExcel) {
      const nombre = fila["NOMBRE"];
      const grado = fila["GRADO"];
      const turno = fila["TURNO"];
      const aula = fila["AULA"];
      const especialidadNombre = fila["ESPECIALIDAD"];
      const docenteTutorNumEmpleado = fila["DOCENTE_TUTOR_NUM_EMPLEADO"];

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
          error: "Falta la columna DOCENTE_TUTOR_NUM_EMPLEADO (obligatoria)",
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
        const aulaValida = await validarAulaEnCatalogo(aula);
        if (!aulaValida) {
          errores.push({
            registro: nombre,
            error: `El aula/espacio '${aula}' no existe en el catálogo activo`,
          });
          continue;
        }
      }

      try {
        const especialidadExiste = await prisma.especialidad.findFirst({
          where: {
            nombre: {
              equals: String(especialidadNombre).trim(),
              mode: "insensitive",
            },
          },
        });

        if (!especialidadExiste) {
          errores.push({
            registro: nombre,
            error: `La especialidad "${especialidadNombre}" no existe`,
          });
          continue;
        }

        const docenteTutorExiste = await prisma.docente.findFirst({
          where: {
            numeroEmpleado: {
              equals: String(docenteTutorNumEmpleado).trim(),
              mode: "insensitive",
            },
          },
          select: { idDocente: true },
        });

        if (!docenteTutorExiste) {
          errores.push({
            registro: nombre,
            error: `No existe docente tutor con número de empleado '${docenteTutorNumEmpleado}'`,
          });
          continue;
        }

        // Buscamos sin periodoId
        const grupoExistente = await prisma.grupo.findFirst({
          where: {
            nombre: String(nombre).trim(),
            grado: parseInt(grado),
            especialidadId: especialidadExiste.idEspecialidad,
          },
        });

        if (grupoExistente) {
          const grupoUpdate = {};
          if (turnoNormalizado !== grupoExistente.turno)
            grupoUpdate.turno = turnoNormalizado;
          if ((aula ? String(aula).trim() : null) !== grupoExistente.aula)
            grupoUpdate.aula = aula ? String(aula).trim() : null;
          if (grupoExistente.docenteTutorId !== docenteTutorExiste.idDocente)
            grupoUpdate.docenteTutorId = docenteTutorExiste.idDocente;

          if (Object.keys(grupoUpdate).length > 0) {
            await prisma.grupo.update({
              where: { idGrupo: grupoExistente.idGrupo },
              data: grupoUpdate,
            });
          }
          datosInsertados.push(nombre);
        } else {
          const nuevoGrupo = await prisma.grupo.create({
            data: {
              nombre: String(nombre).trim(),
              grado: parseInt(grado),
              turno: turnoNormalizado,
              aula: aula ? String(aula).trim() : null,
              especialidadId: especialidadExiste.idEspecialidad,
              docenteTutorId: docenteTutorExiste.idDocente,
            },
          });
          datosInsertados.push(nuevoGrupo.nombre);
        }
      } catch (error) {
        console.error("Error al insertar grupo:", error);
        errores.push({
          registro: nombre,
          error: error.message || "Error al guardar el grupo",
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
    console.error("Error en carga masiva de grupos:", error);
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
        DOCENTE_TUTOR_NUM_EMPLEADO: "DOC001",
      },
    ];

    const instrucciones = [
      { CAMPO: "NOMBRE", DESCRIPCION: "Nombre del grupo (obligatorio)" },
      { CAMPO: "GRADO", DESCRIPCION: "Grado del grupo en numero (obligatorio)" },
      { CAMPO: "TURNO", DESCRIPCION: "MATUTINO, VESPERTINO o MIXTO (obligatorio)" },
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
        CAMPO: "DOCENTE_TUTOR_NUM_EMPLEADO",
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
    console.error("Error al generar plantilla de grupos:", error);
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
