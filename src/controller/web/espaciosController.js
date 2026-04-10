const prisma = require("../../config/prisma");
const XLSX = require("xlsx");

const tiposValidos = ["AULA", "AREACOMUN", "AREA COMUN", "AREA_COMUN"];

const palabrasAula = [
  "AULA",
  "SALON",
  "SALON DE CLASE",
  "SALON CLASE",
  "CLASE",
];

const normalizarTexto = (valor) =>
  String(valor || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const mapearTipoEspacio = (tipoEntrada) => {
  const tipo = normalizarTexto(tipoEntrada);

  if (!tipo) return null;
  if (tipo === "AULA") return "AULA";
  if (tipo === "AREACOMUN" || tipo === "AREA COMUN" || tipo === "AREA_COMUN") {
    return "AREACOMUN";
  }

  if (palabrasAula.includes(tipo)) return "AULA";

  // Cualquier otro texto libre se considera AREACOMUN
  // Ejemplos: LABORATORIO, BIBLIOTECA, CANCHA, PATIO, TALLER, etc.
  return "AREACOMUN";
};

const formatearTipoSalida = (tipo) => {
  const normalizado = String(tipo || "").toUpperCase();
  if (normalizado === "AREACOMUN") return "AREA COMUN";
  return normalizado.replace(/_/g, " ");
};

const formatearEspacioSalida = (espacio = {}) => ({
  ...espacio,
  tipo: formatearTipoSalida(espacio.tipo),
});

const crearEspacio = async (req, res) => {
  try {
    const { nombre, tipo, descripcion } = req.body;

    if (!nombre || !tipo) {
      return res.status(400).json({ error: "nombre y tipo son obligatorios" });
    }

    const tipoNormalizado = mapearTipoEspacio(tipo);
    if (!tipoNormalizado) {
      return res.status(400).json({
        error: "tipo inválido",
      });
    }

    const espacio = await prisma.espacio.create({
      data: {
        nombre: String(nombre).trim(),
        tipo: tipoNormalizado,
        descripcion: descripcion ? String(descripcion).trim() : null,
      },
    });

    return res.status(201).json({
      mensaje: "Espacio registrado",
      espacio: formatearEspacioSalida(espacio),
    });
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
      const tipoNormalizado = mapearTipoEspacio(tipo);
      if (!tipoNormalizado) {
        return res
          .status(400)
          .json({ error: "tipo inválido" });
      }
      where.tipo = tipoNormalizado;
    }

    const espacios = await prisma.espacio.findMany({
      where,
      orderBy: [{ tipo: "asc" }, { nombre: "asc" }],
    });

    return res.json(espacios.map(formatearEspacioSalida));
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
      const tipoNormalizado = mapearTipoEspacio(tipo);
      if (!tipoNormalizado) {
        return res.status(400).json({
          error: "tipo inválido",
        });
      }
      data.tipo = tipoNormalizado;
    }

    const espacio = await prisma.espacio.update({
      where: { idEspacio },
      data,
    });

    return res.json({
      mensaje: "Espacio actualizado",
      espacio: formatearEspacioSalida(espacio),
    });
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

    return res.json({
      mensaje: "Espacio desactivado",
      espacio: formatearEspacioSalida(espacio),
    });
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
      const tipoEntrada = fila["TIPO"];
      const tipo = mapearTipoEspacio(tipoEntrada);
      const descripcionRaw = fila["DESCRIPCION"];
      const descripcion = descripcionRaw ? String(descripcionRaw).trim() : null;

      if (!nombre || !tipo) {
        errores.push({
          fila: numeroFila,
          error: "NOMBRE y TIPO son obligatorios",
        });
        continue;
      }

      if (!tipo) {
        errores.push({
          fila: numeroFila,
          error: "TIPO inválido",
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
        TIPO: "Laboratorio",
        DESCRIPCION: "Zona principal de convivencia",
      },
    ];

    const instrucciones = [
      {
        CAMPO: "NOMBRE",
        DESCRIPCION: "Nombre del espacio (obligatorio y único)",
      },
      {
        CAMPO: "TIPO",
        DESCRIPCION:
          "Texto libre. Ejemplos: Aula, Laboratorio, Biblioteca, Cancha. Se normaliza internamente a AULA o AREA COMUN",
      },
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
