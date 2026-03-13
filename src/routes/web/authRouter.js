const { Router } = require("express");
const router = Router();

const {
  login,
  cambiarPassword,
} = require("../../controller/auth/authController");

router.post("/login", login);
router.put("/cambiar-password", cambiarPassword);

module.exports = router;
