const { Router } = require("express");
const router = Router();

router.get("/", (req, res) => {
  res.json({ mensaje: "Bienvenido al Dashboard Administrativo (Web)" });
});

module.exports = router;
