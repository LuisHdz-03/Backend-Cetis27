const prisma = require("../../config/prisma");
const XLSX = require("xlsx");

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

const cargarEspaciosMasivos = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "No se subió archivo" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const datosExcel = XLSX.utils.sheet_to_json(sheet);

    if (!Array.isArray(datosExcel) || datosExcel.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "El archivo no contiene filas para procesar",
      });
    }

    const errores = [];
    const procesados = [];

    for (let i = 0; i < datosExcel.length; i++) {
      const fila = datosExcel[i];
      const numeroFila = i + 2; // +2 por cabecera de Excel

      const nombre = String(fila["NOMBRE"] || "").trim();
      const tipo = String(fila["TIPO"] || "")
        .trim()
        .toUpperCase();
      const descripcionRaw = fila["DESCRIPCION"];
      const descripcion = descripcionRaw ? String(descripcionRaw).trim() : null;

      if (!nombre || !tipo) {
        errores.push({
          fila: numeroFila,
          error: "NOMBRE y TIPO son obligatorios",
        });
        continue;
      }

      if (!tiposValidos.includes(tipo)) {
        errores.push({
          fila: numeroFila,
          error: "TIPO inválido. Debe ser AULA o AREA_COMUN",
        });
        continue;
      }

      try {
        const existente = await prisma.espacio.findFirst({
          where: { nombre },
          select: { idEspacio: true },
        });

        if (existente) {
          await prisma.espacio.update({
            where: { idEspacio: existente.idEspacio },
            data: {
              tipo,
              descripcion,
              activo: true,
            },
          });

          procesados.push({ nombre, accion: "actualizado" });
        } else {
          await prisma.espacio.create({
            data: {
              nombre,
              tipo,
              descripcion,
            },
          });

          procesados.push({ nombre, accion: "creado" });
        }
      } catch (error) {
        console.error(`Error procesando espacio en fila ${numeroFila}:`, error);
        errores.push({
          fila: numeroFila,
          error: "Error al procesar la fila",
        });
      }
    }

    return res.json({
      ok: errores.length === 0,
      mensaje: `Carga masiva finalizada. Procesados: ${procesados.length}. Errores: ${errores.length}`,
      procesados,
      errores,
    });
  } catch (error) {
    console.error("Error en carga masiva de espacios:", error);
    return res
      .status(500)
      .json({ ok: false, error: "Error al cargar espacios masivamente" });
  }
};

const descargarPlantillaEspacios = async (req, res) => {
  try {
    const filasEjemplo = [
      {
        NOMBRE: "Aula A-101",
        TIPO: "AULA",
        DESCRIPCION: "Primer piso, edificio A",
      },
      {
        NOMBRE: "Patio Central",
        TIPO: "AREA_COMUN",
        DESCRIPCION: "Zona principal de convivencia",
      },
    ];

    const instrucciones = [
      {
        CAMPO: "NOMBRE",
        DESCRIPCION: "Nombre del espacio (obligatorio y único)",
      },
      { CAMPO: "TIPO", DESCRIPCION: "Valores permitidos: AULA o AREA_COMUN" },
      {
        CAMPO: "DESCRIPCION",
        DESCRIPCION: "Descripción del espacio (opcional)",
      },
    ];

    const wb = XLSX.utils.book_new();
    const wsEjemplo = XLSX.utils.json_to_sheet(filasEjemplo);
    const wsInstrucciones = XLSX.utils.json_to_sheet(instrucciones);
    XLSX.utils.book_append_sheet(wb, wsEjemplo, "Plantilla_Espacios");
    XLSX.utils.book_append_sheet(wb, wsInstrucciones, "Instrucciones");

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="plantilla_espacios.xlsx"',
    );

    return res.send(buffer);
  } catch (error) {
    console.error("Error al generar plantilla de espacios:", error);
    return res
      .status(500)
      .json({ error: "Error al generar plantilla de espacios" });
  }
};

module.exports = {
  crearEspacio,
  getEspacios,
  actualizarEspacio,
  eliminarEspacio,
  cargarEspaciosMasivos,
  descargarPlantillaEspacios,
};
