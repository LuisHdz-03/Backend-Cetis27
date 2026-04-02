const prisma = require("../../config/prisma");

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

  try {
    const docente = await prisma.docente.findUnique({
      where: { usuarioId: parseInt(idDocente) },
    });

    if (!docente) {
      return res.status(404).json({
        error: "No se encontró un perfil de docente para este usuario",
      });
    }

    const filtroPeriodo = await resolverFiltroPeriodo(req.query);

    const clases = await prisma.clase.findMany({
      where: { docenteId: docente.idDocente, ...filtroPeriodo },
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
