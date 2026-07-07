const XLSX = require("xlsx");

const MAX_BULK_EXCEL_ROWS = parseInt(
  process.env.MAX_BULK_EXCEL_ROWS || "2000",
  10,
);

const DANGEROUS_EXCEL_KEYS = new Set([
  "__proto__",
  "prototype",
  "constructor",
]);

const validateBulkRows = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      status: 400,
      error: "El archivo no contiene filas para procesar",
    };
  }

  if (rows.length > MAX_BULK_EXCEL_ROWS) {
    return {
      status: 413,
      error: `El archivo excede el limite de ${MAX_BULK_EXCEL_ROWS} filas por carga`,
    };
  }

  return null;
};

const buildBulkProcessingMessage = (insertados, fallidos) => {
  if (fallidos === 0) {
    return "Carga masiva completada sin errores";
  }

  return `Se procesaron ${insertados} registro(s) correctamente y ${fallidos} no se procesaron. Los registros con error se omitieron y no se guardaron; revisa 'detalles' para corregirlos.`;
};

const buildBulkProcessingFeedback = (insertados, fallidos) => {
  const hayRegistrosOmitidos = fallidos > 0;

  return {
    tipo: hayRegistrosOmitidos ? "warning" : "success",
    codigo: hayRegistrosOmitidos
      ? "CARGA_MASIVA_PARCIAL"
      : "CARGA_MASIVA_COMPLETA",
    titulo: hayRegistrosOmitidos
      ? "Carga masiva completada con observaciones"
      : "Carga masiva completada",
    mensaje: buildBulkProcessingMessage(insertados, fallidos),
    hayRegistrosOmitidos,
    esErrorSistema: false,
  };
};

const sanitizeExcelRows = (rows) =>
  rows.map((row) => {
    const safeRow = Object.create(null);

    for (const [key, value] of Object.entries(row || {})) {
      if (!DANGEROUS_EXCEL_KEYS.has(String(key))) {
        safeRow[key] = value;
      }
    }

    return safeRow;
  });

const parseExcelRowsSafe = (buffer, options = {}) => {
  if (!Buffer.isBuffer(buffer)) {
    return [];
  }

  const { defval } = options;
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    dense: true,
    cellFormula: false,
    cellHTML: false,
    cellNF: false,
    cellStyles: false,
    sheetStubs: false,
    sheetRows: MAX_BULK_EXCEL_ROWS + 1,
    WTF: false,
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return [];
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval,
    raw: false,
    blankrows: false,
  });

  return sanitizeExcelRows(rows);
};

module.exports = {
  validateBulkRows,
  buildBulkProcessingMessage,
  buildBulkProcessingFeedback,
  parseExcelRowsSafe,
  MAX_BULK_EXCEL_ROWS,
};