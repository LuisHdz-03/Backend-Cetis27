const prisma = require("../../config/prisma");
const XLSX = require("xlsx");

const crearGrupo = async (req, res) => {
  try {
    const {
      nombre,
      grado,
      turno,
      aula,
      periodoId,
      especialidadId,
      docenteId,
      materiasIds,
    } = req.body;

    if (!periodoId || !especialidadId) {
      return res
        .status(400)
        .json({ error: "Faltan IDs de Periodo o Especialidad" });
    }

    const nuevoGrupo = await prisma.$transaction(async (tx) => {
      const grupoCreado = await tx.grupo.create({
        data: {
          nombre,
          grado: parseInt(grado),
          turno,
          aula,
          periodoId: parseInt(periodoId),
          especialidadId: parseInt(especialidadId),
        },
      });

      if (
        docenteId &&
        materiasIds &&
        Array.isArray(materiasIds) &&
        materiasIds.length > 0
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
      include: {
        especialidad: {
          select: { nombre: true, codigo: true },
        },
        periodo: {
          select: { nombre: true, activo: true },
        },
        clases: {
          include: {
            materias: true,
            docente: {
              include: {
                usuario: { select: { nombre: true, apellidoPaterno: true } },
              },
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
        periodo: true,
        clases: {
          include: {
            materias: true,
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
    const { nombre, grado, turno, aula, periodoId, especialidadId } = req.body;

    const grupoId = parseInt(id);

    if (isNaN(grupoId)) {
      return res.status(400).json({ error: "ID de grupo inválido" });
    }

    const grupoExiste = await prisma.grupo.findUnique({
      where: { idGrupo: grupoId },
    });

    if (!grupoExiste) {
      return res.status(404).json({ error: "Grupo no encontrado" });
    }

    const turnosValidos = ["MATUTINO", "VESPERTINO", "MIXTO"];
    if (turno) {
      const turnoNormalizado = turno.trim().toUpperCase();
      if (!turnosValidos.includes(turnoNormalizado)) {
        return res.status(400).json({
          error: `Turno inválido: ${turno}. Debe ser MATUTINO, VESPERTINO o MIXTO`,
        });
      }
    }

    if (especialidadId) {
      const especialidadExiste = await prisma.especialidad.findUnique({
        where: { idEspecialidad: parseInt(especialidadId) },
      });

      if (!especialidadExiste) {
        return res.status(400).json({
          error: `La especialidad con ID ${especialidadId} no existe`,
        });
      }
    }

    if (periodoId) {
      const periodoExiste = await prisma.periodo.findUnique({
        where: { idPeriodo: parseInt(periodoId) },
      });

      if (!periodoExiste) {
        return res.status(400).json({
          error: `El periodo con ID ${periodoId} no existe`,
        });
      }
    }

    const dataActualizar = {};
    if (nombre !== undefined) dataActualizar.nombre = nombre.trim();
    if (grado !== undefined) dataActualizar.grado = parseInt(grado);
    if (turno !== undefined) dataActualizar.turno = turno.trim().toUpperCase();
    if (aula !== undefined) dataActualizar.aula = aula ? aula.trim() : null;
    if (periodoId !== undefined) dataActualizar.periodoId = parseInt(periodoId);
    if (especialidadId !== undefined)
      dataActualizar.especialidadId = parseInt(especialidadId);

    const grupoActualizado = await prisma.grupo.update({
      where: { idGrupo: grupoId },
      data: dataActualizar,
    });

    res.json({
      mensaje: "Grupo actualizado exitosamente",
      grupo: grupoActualizado,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar el grupo" });
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

    const periodoActivo = await prisma.periodo.findFirst({
      where: { activo: true },
    });
    if (!periodoActivo) {
      return res
        .status(400)
        .json({ error: "No hay un periodo activo. Crea uno primero." });
    }

    const turnosValidos = ["MATUTINO", "VESPERTINO", "MIXTO"];

    for (const fila of datosExcel) {
      const nombre = fila["NOMBRE"];
      const grado = fila["GRADO"];
      const turno = fila["TURNO"];
      const aula = fila["AULA"];
      const especialidadNombre = fila["ESPECIALIDAD"];
      const periodoNombre = fila["PERIODO"];

      if (!nombre || !grado || !turno || !especialidadNombre) {
        errores.push({
          registro: nombre || "Desconocido",
          error: "Faltan columnas (NOMBRE, GRADO, TURNO o ESPECIALIDAD)",
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

        let periodoFinal = periodoActivo.idPeriodo;
        if (periodoNombre) {
          const periodoExiste = await prisma.periodo.findFirst({
            where: {
              nombre: {
                equals: String(periodoNombre).trim(),
                mode: "insensitive",
              },
            },
          });

          if (!periodoExiste) {
            errores.push({
              registro: nombre,
              error: `El periodo "${periodoNombre}" no existe`,
            });
            continue;
          }
          periodoFinal = periodoExiste.idPeriodo;
        }

        const grupoExistente = await prisma.grupo.findFirst({
          where: {
            nombre: String(nombre).trim(),
            grado: parseInt(grado),
            especialidadId: especialidadExiste.idEspecialidad,
            periodoId: periodoFinal,
          },
        });

        if (grupoExistente) {
          const grupoUpdate = {};
          if (turnoNormalizado !== grupoExistente.turno)
            grupoUpdate.turno = turnoNormalizado;
          if ((aula ? String(aula).trim() : null) !== grupoExistente.aula)
            grupoUpdate.aula = aula ? String(aula).trim() : null;

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
              periodoId: periodoFinal,
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

module.exports = {
  crearGrupo,
  getGrupos,
  getGrupoById,
  actualizarGrupo,
  eliminarGrupo,
  cargarGruposMasivos,
};
