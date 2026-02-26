const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const crearAdministrativo = async (req, res) => {
  try {
    const {
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      email,
      password,
      cargo,
      area,
      numeroEmpleado,
      rol,
    } = req.body;

    const rolesPermitidos = ["ADMINISTRATIVO", "DIRECTIVO", "GUARDIA"];

    const rolAsignar = rol ? rol.toUpperCase() : "ADMINISTRATIVO";

    if (!rolesPermitidos.includes(rolAsignar)) {
      return res.status(400).json({
        error: `El rol '${rolAsignar}' no es válido para este perfil. Usa: ${rolesPermitidos.join(", ")}`,
      });
    }

    const nuevoAdmin = await prisma.$transaction(async (prisma) => {
      const usuario = await prisma.usuario.create({
        data: {
          nombre,
          apellidoPaterno,
          apellidoMaterno,
          email,
          password,
          rol: rolAsignar,
          activo: true,
        },
      });

      const perfil = await prisma.administrativo.create({
        data: {
          numeroEmpleado,
          cargo,
          area,
          usuarioId: usuario.idUsuario,
        },
      });

      return { usuario, perfil };
    });

    res.status(201).json({
      mensaje: `Personal registrado correctamente como ${rolAsignar}`,
      data: nuevoAdmin,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al registrar personal." });
  }
};

const getAdministrativos = async (req, res) => {
  try {
    const admins = await prisma.administrativo.findMany({
      include: {
        usuario: {
          select: {
            nombre: true,
            apellidoPaterno: true,
            email: true,
            rol: true,
            activo: true,
          },
        },
      },
    });
    res.json(admins);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener lista." });
  }
};
const cargarAdministrativosMasivos = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, msg: "no se subio archivo" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const datosExcel = XLSX.utils.sheet_to_json(sheet);

    const errores = [];
    const datosInsertados = [];

    for (const fila of datosExcel) {
      const nombreExcel = fila["NOMBRE"];
      const paternoExcel = fila["PATERNO"];
      const maternoExcel = fila["MATERNO"];
      const emailExcel = fila["EMAIL"];
      const curpExcel = fila["CURP"];
      const numEmpleadoExcel = fila["NUM EMPLEADO"];
      const cargoExcel = fila["CARGO"];
      const areaExcel = fila["AREA"];

      if (
        !nombreExcel ||
        !numEmpleadoExcel ||
        !curpExcel ||
        !cargoExcel ||
        !areaExcel
      ) {
        errores.push({
          numeroEmpleado: numEmpleadoExcel || "Desc",
          error:
            "Faltan datos clave (Nombre, Num Empleado, CURP, Cargo o Area)",
        });
        continue;
      }

      try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(
          String(numEmpleadoExcel),
          salt,
        );

        await prisma.$transaction(async (tx) => {
          const nuevoUsuario = await tx.usuario.create({
            data: {
              nombre: nombreExcel,
              apellidoPaterno: paternoExcel || "",
              apellidoMaterno: maternoExcel || "",
              email: emailExcel.trim().toLowerCase(),
              curp: curpExcel.trim().toUpperCase(),
              password: hashedPassword,
              rol: "ADMINISTRATIVO",
              activo: true,
            },
          });

          await tx.administrativo.create({
            data: {
              numeroEmpleado: String(numEmpleadoExcel),
              cargo: cargoExcel,
              area: areaExcel,
              usuarioId: nuevoUsuario.idUsuario,
            },
          });
        });

        datosInsertados.push(numEmpleadoExcel);
      } catch (error) {
        console.error(`Error con administrativo ${numEmpleadoExcel}: `, error);
        let msg = "Error al procesar la fila";

        if (error.code === "P2002") {
          const target = error.meta?.target || "";
          msg = target.includes("email") ? "Email duplicado" : "CURP duplicada";
        }

        errores.push({ numeroEmpleado: numEmpleadoExcel, error: msg });
      }
    }

    res.json({
      ok: true,
      insertados: datosInsertados.length,
      fallidos: errores.length,
      detalles: errores,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, msg: "Error de servidor" });
  }
};

module.exports = {
  crearAdministrativo,
  getAdministrativos,
  cargarAdministrativosMasivos,
};
