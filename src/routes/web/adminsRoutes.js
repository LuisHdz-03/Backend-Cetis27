const { Router } = require("express");
const router = Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const {
  crearAdministrativo,
  getAdministrativos,
  cargarAdministrativosMasivos,
} = require("../../controller/web/administrativoController");
const multer = require("multer");

router.post("/", crearAdministrativo);
router.get("/", getAdministrativos);
router.post(
  "/masivos",
  upload.single("archivosExcel"),
  cargarAdministrativosMasivos,
);

module.exports = router;
