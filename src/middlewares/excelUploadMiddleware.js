const path = require("path");
const multer = require("multer");

const MAX_EXCEL_FILE_SIZE_MB = parseInt(
  process.env.MAX_EXCEL_FILE_SIZE_MB || "10",
  10,
);

const excelMimeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
  "application/octet-stream",
]);

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: MAX_EXCEL_FILE_SIZE_MB * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const isExcelExtension = [".xlsx", ".xls", ".csv"].includes(extension);
    const isExcelMime = excelMimeTypes.has(file.mimetype);

    if (isExcelExtension || isExcelMime) {
      return cb(null, true);
    }

    return cb(
      new Error("Solo se permiten archivos Excel o CSV para cargas masivas"),
      false,
    );
  },
});

const normalizeFieldNames = (fieldNames) => {
  const fields = Array.isArray(fieldNames) ? fieldNames : [fieldNames];
  const normalizedFields = fields.filter(Boolean);

  if (normalizedFields.includes("archivoExcel")) {
    normalizedFields.push("archivo", "file");
  }

  return [...new Set(normalizedFields)];
};

const uploadExcelSingle = (fieldName) => (req, res, next) => {
  const fieldNames = normalizeFieldNames(fieldName);
  const handler =
    fieldNames.length === 1
      ? excelUpload.single(fieldNames[0])
      : excelUpload.fields(
          fieldNames.map((currentFieldName) => ({
            name: currentFieldName,
            maxCount: 1,
          })),
        );

  handler(req, res, (error) => {
    if (!error && !req.file && req.files) {
      for (const currentFieldName of fieldNames) {
        const currentFiles = req.files[currentFieldName];
        if (Array.isArray(currentFiles) && currentFiles.length > 0) {
          [req.file] = currentFiles;
          break;
        }
      }
    }

    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          ok: false,
          error: `El archivo excede el limite de ${MAX_EXCEL_FILE_SIZE_MB}MB`,
        });
      }

      return res.status(400).json({ ok: false, error: error.message });
    }

    return res.status(400).json({ ok: false, error: error.message });
  });
};

module.exports = {
  uploadExcelSingle,
  MAX_EXCEL_FILE_SIZE_MB,
};
