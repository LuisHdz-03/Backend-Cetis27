const MAX_BULK_EXCEL_ROWS = parseInt(
  process.env.MAX_BULK_EXCEL_ROWS || "2000",
  10,
);

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

module.exports = {
  validateBulkRows,
  MAX_BULK_EXCEL_ROWS,
};