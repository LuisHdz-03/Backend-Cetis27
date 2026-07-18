const prisma = require("../../config/prisma");

const parseBooleanInput = (value, defaultValue = undefined) => {
  if (value === undefined) return defaultValue;
  if (typeof value === "boolean") return value;

  const normalizedValue = String(value).trim().toLowerCase();
  if (["true", "1", "si", "sí"].includes(normalizedValue)) return true;
  if (["false", "0", "no"].includes(normalizedValue)) return false;

  return null;
};

const parseFecha = (value) => {
  const fecha = new Date(value);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

const actualizarNombreGrupoPromovido = (nombreGrupo, gradoActual) => {
  const nombre = String(nombreGrupo || "").trim();
  const gradoSiguiente = Number(gradoActual) + 1;
  const patronInicio = new RegExp(`^${gradoActual}(?=\\D|$)`);

  if (!nombre) {
    return nombre;
  }

  if (patronInicio.test(nombre)) {
    return nombre.replace(patronInicio, String(gradoSiguiente));
  }

  return nombre;
};

const crearPeriodo = async (req, res) => {
  try {
    const { nombre, codigo, fechaInicio, fechaFin, activo } = req.body;
    const nombreNormalizado = String(nombre || "").trim();
    const fechaInicioDate = parseFecha(fechaInicio);
    const fechaFinDate = parseFecha(fechaFin);
    const seraActivo = parseBooleanInput(activo, true);

    if (!nombreNormalizado) {
      return res
        .status(400)
        .json({ error: "El nombre del periodo es obligatorio." });
    }

    if (!fechaInicioDate || !fechaFinDate) {
      return res
        .status(400)
        .json({ error: "Las fechas del periodo son inválidas." });
    }

    if (fechaInicioDate >= fechaFinDate) {
      return res
        .status(400)
        .json({
          error: "La fecha de inicio debe ser menor a la fecha de fin.",
        });
    }

    if (seraActivo === null) {
      return res
        .status(400)
        .json({ error: "El campo activo debe ser booleano." });
    }

    const nuevoPeriodo = await prisma.$transaction(async (tx) => {
      if (seraActivo) {
        await tx.periodo.updateMany({
          data: { activo: false },
        });
      }

      return tx.periodo.create({
        data: {
          nombre: nombreNormalizado,
          codigo: codigo || nombreNormalizado.substring(0, 4).toUpperCase(),
          fechaInicio: fechaInicioDate,
          fechaFin: fechaFinDate,
          activo: seraActivo,
        },
      });
    });

    res.status(201).json(nuevoPeriodo);
  } catch (error) {
    res.status(500).json({ error: "Error al crear periodo." });
  }
};

const getPeriodos = async (req, res) => {
  try {
    const { activos } = req.query;

    let whereClause = {};
    if (activos === "true") {
      whereClause.activo = true;
    }

    const periodos = await prisma.periodo.findMany({
      where: whereClause, // 3. Aplicamos el filtro a la consulta
      orderBy: { fechaInicio: "desc" },
    });

    res.json(periodos);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener periodos." });
  }
};

const getPeriodoActivo = async (req, res) => {
  try {
    const periodoActivo = await prisma.periodo.findFirst({
      where: { activo: true },
      orderBy: { fechaInicio: "desc" },
    });

    if (!periodoActivo) {
      return res.status(404).json({ error: "No hay periodo activo." });
    }

    return res.json(periodoActivo);
  } catch (error) {
    return res.status(500).json({ error: "Error al obtener periodo activo." });
  }
};

const setPeriodoActual = async (req, res) => {
  const { idPeriodo } = req.params;

  try {
    await prisma.$transaction([
      prisma.periodo.updateMany({
        data: { activo: false },
      }),
      prisma.periodo.update({
        where: { idPeriodo: parseInt(idPeriodo) },
        data: { activo: true },
      }),
    ]);

    res.json({ mensaje: `Periodo ${idPeriodo} establecido como ACTUAL.` });
  } catch (error) {
    res.status(500).json({ error: "Error al cambiar de periodo." });
  }
};

const cerrarPeriodoYPromover = async (req, res) => {
  const { id } = req.params;
  const idPeriodo = parseInt(id);

  if (isNaN(idPeriodo)) {
    return res.status(400).json({ error: "ID de periodo inválido" });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.periodo.update({
        where: { idPeriodo },
        data: { activo: false },
      });

      await tx.usuario.updateMany({
        where: { estudiante: { semestre: 6 } },
        data: { activo: false },
      });

      await tx.estudiante.updateMany({
        where: {
          semestre: { lt: 6 },
          usuario: { activo: true },
        },
        data: {
          semestre: { increment: 1 },
        },
      });

      await tx.grupo.updateMany({
        where: { grado: 6 },
        data: { activo: false },
      });

      const gruposPromover = await tx.grupo.findMany({
        where: { grado: { lt: 6 }, activo: true },
        select: { idGrupo: true, nombre: true, grado: true },
      });

      await Promise.all(
        gruposPromover.map((grupo) => {
          const nuevoNombre = actualizarNombreGrupoPromovido(
            grupo.nombre,
            grupo.grado,
          );

          return tx.grupo.update({
            where: { idGrupo: grupo.idGrupo },
            data: { grado: { increment: 1 }, nombre: nuevoNombre },
          });
        }),
      );
    });

    res.status(200).json({
      mensaje: "Periodo cerrado. Estudiantes promovidos y grupos actualizados.",
    });
  } catch (error) {
    console.error("Error al cerrar periodo:", error);
    res.status(500).json({ error: "Error interno al cerrar el periodo." });
  }
};

const updatePeriodo = async (req, res) => {
  const { idPeriodo } = req.params;
  const { nombre, codigo, fechaInicio, fechaFin } = req.body;

  try {
    const dataToUpdate = {};
    if (nombre) dataToUpdate.nombre = nombre;
    if (codigo) dataToUpdate.codigo = codigo;
    if (fechaInicio) dataToUpdate.fechaInicio = new Date(fechaInicio);
    if (fechaFin) dataToUpdate.fechaFin = new Date(fechaFin);

    const periodoActualizado = await prisma.periodo.update({
      where: { idPeriodo: parseInt(idPeriodo) },
      data: dataToUpdate,
    });
    res.json(periodoActualizado);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Periodo no encontrado." });
    }
    res.status(500).json({ error: "Error al actualizar el periodo." });
  }
};

module.exports = {
  crearPeriodo,
  getPeriodos,
  getPeriodoActivo,
  setPeriodoActual,
  cerrarPeriodoYPromover,
  updatePeriodo,
};
