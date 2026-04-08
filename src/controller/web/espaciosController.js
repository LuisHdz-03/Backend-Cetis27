const prisma = require("../../config/prisma");

const tiposValidos = ["AULA", "AREA_COMUN"];

const crearEspacio = async (req, res) => {
  try {
    const { nombre, tipo, descripcion } = req.body;

    if (!nombre || !tipo) {
      return res.status(400).json({ error: "nombre y tipo son obligatorios" });
    }

    const tipoNormalizado = String(tipo).trim().toUpperCase();
    if (!tiposValidos.includes(tipoNormalizado)) {
      return res.status(400).json({
        error: "tipo inválido. Debe ser AULA o AREA_COMUN",
      });
    }

    const espacio = await prisma.espacio.create({
      data: {
        nombre: String(nombre).trim(),
        tipo: tipoNormalizado,
        descripcion: descripcion ? String(descripcion).trim() : null,
      },
    });

    return res.status(201).json({ mensaje: "Espacio registrado", espacio });
  } catch (error) {
    console.error(error);
    if (error.code === "P2002") {
      return res
        .status(400)
        .json({ error: "Ya existe un espacio con ese nombre" });
    }
    return res.status(500).json({ error: "Error al registrar espacio" });
  }
};

const getEspacios = async (req, res) => {
  try {
    const { tipo, incluirInactivos } = req.query;

    const where = {};
    if (
      !incluirInactivos ||
      String(incluirInactivos).toLowerCase() !== "true"
    ) {
      where.activo = true;
    }

    if (tipo) {
      const tipoNormalizado = String(tipo).trim().toUpperCase();
      if (!tiposValidos.includes(tipoNormalizado)) {
        return res
          .status(400)
          .json({ error: "tipo inválido. Debe ser AULA o AREA_COMUN" });
      }
      where.tipo = tipoNormalizado;
    }

    const espacios = await prisma.espacio.findMany({
      where,
      orderBy: [{ tipo: "asc" }, { nombre: "asc" }],
    });

    return res.json(espacios);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al obtener espacios" });
  }
};

const actualizarEspacio = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, tipo, descripcion, activo } = req.body;

    const idEspacio = parseInt(id, 10);
    if (isNaN(idEspacio)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const data = {};
    if (nombre !== undefined) data.nombre = String(nombre).trim();
    if (descripcion !== undefined) {
      data.descripcion = descripcion ? String(descripcion).trim() : null;
    }
    if (activo !== undefined) data.activo = Boolean(activo);

    if (tipo !== undefined) {
      const tipoNormalizado = String(tipo).trim().toUpperCase();
      if (!tiposValidos.includes(tipoNormalizado)) {
        return res.status(400).json({
          error: "tipo inválido. Debe ser AULA o AREA_COMUN",
        });
      }
      data.tipo = tipoNormalizado;
    }

    const espacio = await prisma.espacio.update({
      where: { idEspacio },
      data,
    });

    return res.json({ mensaje: "Espacio actualizado", espacio });
  } catch (error) {
    console.error(error);
    if (error.code === "P2002") {
      return res
        .status(400)
        .json({ error: "Ya existe un espacio con ese nombre" });
    }
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Espacio no encontrado" });
    }
    return res.status(500).json({ error: "Error al actualizar espacio" });
  }
};

const eliminarEspacio = async (req, res) => {
  try {
    const { id } = req.params;
    const idEspacio = parseInt(id, 10);

    if (isNaN(idEspacio)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const espacio = await prisma.espacio.update({
      where: { idEspacio },
      data: { activo: false },
    });

    return res.json({ mensaje: "Espacio desactivado", espacio });
  } catch (error) {
    console.error(error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Espacio no encontrado" });
    }
    return res.status(500).json({ error: "Error al desactivar espacio" });
  }
};

module.exports = {
  crearEspacio,
  getEspacios,
  actualizarEspacio,
  eliminarEspacio,
};
