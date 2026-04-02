const prisma = require("../../config/prisma");
const XLSX = require("xlsx");

const crearEspecialidad = async (req, res) => {
  try {
    const { nombre, codigo, descripcion } = req.body;
    const nueva = await prisma.especialidad.create({
      data: { nombre, codigo, descripcion },
    });
    res.status(201).json(nueva);
  } catch (error) {
    res.status(500).json({ error: "No se pudo crear una nueva especialidad" });
  }
};

const getEspecialidad = async (req, res) => {
  try {
    const lista = await prisma.especialidad.findMany({
      include: {
        _count: { select: { grupos: true } },
      },
    });
    res.json(lista);
  } catch (error) {
    res.status(500).json({ error: "No se pudo obtener las especialidades" });
  }
};

const actualizarEspecialidad = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, codigo } = req.body;

    const especialidadId = parseInt(id);

    if (isNaN(especialidadId)) {
      return res.status(400).json({ error: "ID de especialidad inválido" });
    }

    // Verificar que la especialidad existe
    const especialidadExiste = await prisma.especialidad.findUnique({
      where: { idEspecialidad: especialidadId },
    });

    if (!especialidadExiste) {
      return res.status(404).json({ error: "Especialidad no encontrada" });
    }

    // Actualizar especialidad
    const dataActualizar = {};
    if (nombre !== undefined)
      dataActualizar.nombre = nombre.trim().toUpperCase();
    if (codigo !== undefined)
      dataActualizar.codigo = codigo.trim().toUpperCase();

    const especialidadActualizada = await prisma.especialidad.update({
      where: { idEspecialidad: especialidadId },
      data: dataActualizar,
    });

    res.json({
      mensaje: "Especialidad actualizada exitosamente",
      especialidad: especialidadActualizada,
    });
  } catch (error) {
    console.error(error);
    if (error.code === "P2002") {
      return res.status(400).json({
        error: "Ya existe una especialidad con ese nombre o código",
      });
    }
    res.status(500).json({ error: "Error al actualizar la especialidad" });
  }
};

const eliminarEspecialidad = async (req, res) => {
  try {
    const { id } = req.params;

    const especialidadId = parseInt(id);

    if (isNaN(especialidadId)) {
      return res.status(400).json({ error: "ID de especialidad inválido" });
    }

    await prisma.especialidad.delete({
      where: { idEspecialidad: especialidadId },
    });

    res.json({ mensaje: "Especialidad eliminada correctamente" });
  } catch (error) {
    console.error(error);
    if (error.code === "P2003") {
      return res.status(400).json({
        error:
          "No se puede eliminar la especialidad porque tiene grupos o materias asignadas",
      });
    }
    res.status(500).json({ error: "Error al eliminar la especialidad" });
  }
};

const cargarEspecialidadesMasivas = async (req, res) => {
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

      // Validar campos obligatorios
      if (!nombre || !codigo) {
        errores.push({
          registro: nombre || "Desconocido",
          error: "Faltan columnas obligatorias (NOMBRE y CODIGO)",
        });
        continue;
      }

      try {
        // Buscar si ya existe una especialidad con ese código
        const especialidadExiste = await prisma.especialidad.findFirst({
          where: {
            codigo: { equals: String(codigo).trim(), mode: "insensitive" },
          },
        });

        if (especialidadExiste) {
          // Si existe, actualizar solo los campos que sean diferentes
          const especialidadUpdate = {};
          const nombreNormalizado = String(nombre).trim().toUpperCase();

          if (nombreNormalizado !== especialidadExiste.nombre)
            especialidadUpdate.nombre = nombreNormalizado;

          if (Object.keys(especialidadUpdate).length > 0) {
            await prisma.especialidad.update({
              where: { idEspecialidad: especialidadExiste.idEspecialidad },
              data: especialidadUpdate,
            });
          }
          datosInsertados.push(nombre);
        } else {
          // Si no existe, crear nueva
          const nuevaEspe = await prisma.especialidad.create({
            data: {
              nombre: String(nombre).trim().toUpperCase(),
              codigo: String(codigo).trim().toUpperCase(),
            },
          });
          datosInsertados.push(nuevaEspe.nombre);
        }
      } catch (error) {
        console.error("Error al insertar especialidad:", error);
        errores.push({
          registro: nombre,
          error: error.message || "Error al guardar la especialidad",
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
    console.error("Error en carga masiva de especialidades:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

module.exports = {
  crearEspecialidad,
  getEspecialidad,
  actualizarEspecialidad,
  eliminarEspecialidad,
  cargarEspecialidadesMasivas,
};
