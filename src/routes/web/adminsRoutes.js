const { Router } = require("express");
const router = Router();
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const {
  crearAdministrativo,
  getAdministrativos,
  cargarAdministrativosMasivos,
  asignarMateria,
  actualizarAdministrativo,
  eliminarAdministrativo,
} = require("../../controller/web/administrativoController");

router.post("/", crearAdministrativo);
router.get("/", getAdministrativos);
router.post("/asignar-materia", asignarMateria);
router.post(
  "/masivo",
  upload.single("archivoExcel"),
  cargarAdministrativosMasivos,
);
router.put("/:id", actualizarAdministrativo);
router.delete("/:id", eliminarAdministrativo);
module.exports = router;
