const { PrismaClient } = require("@prisma/client");
const XLSX = require("xlsx");
const prisma = new PrismaClient();

const crearMateria = async (req, res) => {
  try {
    const { nombre, codigo, horasSemana, semestre, especialidadId } = req.body;

    const existe = await prisma.materia.findFirst({
      where: { codigo: codigo },
    });

    if (existe) {
      return res.status(400).json({ error: "La materia ya existe" });
    }

    const nuevaMateria = await prisma.materia.create({
      data: {
        nombre,
        codigo,
        horasSemana: parseInt(horasSemana),
        semestre: parseInt(semestre),
        especialidadId: especialidadId ? parseInt(especialidadId) : null,
      },
    });

    res
      .status(201)
      .json({ mensaje: "Materia nueva creada", materia: nuevaMateria });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "error al crear la materia" });
  }
};

const getMateria = async (req, res) => {
  try {
    const materias = await prisma.materia.findMany({
      include: {
        especialidad: {
          select: { nombre: true },
        },
      },
    });
    res.json(materias);
  } catch (error) {
    res.status(500).json({ error: "error al obtener las materias" });
  }
};

const actualizarMateria = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, codigo, horasSemana, semestre, especialidadId } = req.body;

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

    // Validar especialidad si se proporciona
    if (especialidadId !== undefined && especialidadId !== null) {
      const especialidadExiste = await prisma.especialidad.findUnique({
        where: { idEspecialidad: parseInt(especialidadId) },
      });

      if (!especialidadExiste) {
        return res.status(400).json({
          error: `La especialidad con ID ${especialidadId} no existe`,
        });
      }
    }

    // Actualizar materia
    const dataActualizar = {};
    if (nombre !== undefined) dataActualizar.nombre = nombre.trim();
    if (codigo !== undefined)
      dataActualizar.codigo = codigo ? codigo.trim().toUpperCase() : null;
    if (horasSemana !== undefined)
      dataActualizar.horasSemana = horasSemana ? parseInt(horasSemana) : null;
    if (semestre !== undefined)
      dataActualizar.semestre = semestre ? parseInt(semestre) : null;
    if (especialidadId !== undefined)
      dataActualizar.especialidadId =
        especialidadId !== null ? parseInt(especialidadId) : null;

    const materiaActualizada = await prisma.materia.update({
      where: { idMateria: materiaId },
      data: dataActualizar,
    });

    res.json({
      mensaje: "Materia actualizada exitosamente",
      materia: materiaActualizada,
    });
  } catch (error) {
    console.error(error);
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
    console.error(error);
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

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const datosExcel = XLSX.utils.sheet_to_json(sheet);

    const errores = [];
    const datosInsertados = [];

    for (const fila of datosExcel) {
      const nombre = fila["NOMBRE"];
      const codigo = fila["CODIGO"];
      const horasSemana = fila["HORAS_SEMANA"];
      const semestre = fila["SEMESTRE"];
      const especialidadNombre = fila["ESPECIALIDAD"];

      // Validar campo obligatorio
      if (!nombre) {
        errores.push({
          registro: nombre || "Desconocido",
          error: "Falta la columna NOMBRE",
        });
        continue;
      }

      try {
        // Validar si ya existe una materia con ese nombre o código
        const materiaExiste = await prisma.materia.findFirst({
          where: {
            OR: [
              {
                nombre: { equals: String(nombre).trim(), mode: "insensitive" },
              },
              codigo
                ? {
                    codigo: {
                      equals: String(codigo).trim(),
                      mode: "insensitive",
                    },
                  }
                : {},
            ],
          },
        });

        if (materiaExiste) {
          errores.push({
            registro: nombre,
            error: `Ya existe una materia con ese nombre o código`,
          });
          continue;
        }

        // Si se especifica especialidad, buscarla por nombre
        let especialidadId = null;
        if (especialidadNombre) {
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
          especialidadId = especialidadExiste.idEspecialidad;
        }

        // Crear la materia
        const nuevaMateria = await prisma.materia.create({
          data: {
            nombre: String(nombre).trim(),
            codigo: codigo ? String(codigo).trim().toUpperCase() : null,
            horasSemana: horasSemana ? parseInt(horasSemana) : null,
            semestre: semestre ? parseInt(semestre) : null,
            especialidadId: especialidadId,
          },
        });
        datosInsertados.push(nuevaMateria.nombre);
      } catch (error) {
        console.error("Error al insertar materia:", error);
        errores.push({
          registro: nombre,
          error: error.message || "Error al guardar la materia",
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
    console.error("Error en carga masiva de materias:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

module.exports = {
  crearMateria,
  getMateria,
  actualizarMateria,
  eliminarMateria,
  cargarMateriasMasivas,
};
