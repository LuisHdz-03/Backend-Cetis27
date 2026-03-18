const prisma = require("../../config/prisma");

const crearClase = async (req, res) => {
  try {
    const { grupoId, materiaId, docenteId, periodoId, horario } = req.body;

    if (!grupoId || !materiaId || !docenteId || !periodoId) {
      return res
        .status(400)
        .json({ error: "Faltan datos obligatorios para asignar la clase" });
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
          connect: { idDocente: parseInt(docenteId) },
        },
        periodo: {
          connect: { idPeriodo: parseInt(periodoId) },
        },
      },
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
    const clase = await prisma.clase.findMany({
      include: {
        grupo: {
          select: {
            nombre: true,
            grado: true,
            turno: true,
          },
        },
        materias: {
          select: {
            nombre: true,
            codigo: true,
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
        periodo: true,
      },
    });
    res.json(clase);
  } catch (error) {
    console.error("Error al traer clases:", error);
    res.status(500).json({ error: "No se pudieron traer las clases" });
  }
};

const getClaseByDocente = async (req, res) => {
  const { idDocente } = req.params;

  try {
    const docente = await prisma.docente.findUnique({
      where: { usuarioId: parseInt(idDocente) },
    });

    if (!docente) {
      return res.status(404).json({
        error: "No se encontró un perfil de docente para este usuario",
      });
    }

    const clases = await prisma.clase.findMany({
      where: { docenteId: docente.idDocente },
      include: {
        grupo: true,
        materias: true,
        periodo: true,
      },
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
      include: {
        grupo: {
          select: {
            nombre: true,
            grado: true,
            turno: true,
          },
        },
        materias: {
          select: {
            nombre: true,
            codigo: true,
          },
        },
        docente: {
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
        periodo: {
          select: {
            nombre: true,
            fechaInicio: true,
            fechaFin: true,
          },
        },
      },
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

module.exports = { crearClase, getClase, getClaseByDocente, actualizarClase };
