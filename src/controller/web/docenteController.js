const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const XLSX = require("xlsx");
const prisma = new PrismaClient();

const crearDocente = async (req, res) => {
  try {
    const {
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      email,
      numeroEmpleado,
      password,
    } = req.body;

    const passToHash = password || numeroEmpleado;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(passToHash, salt);

    const resultado = await prisma.$transaction(async (tx) => {
      const nuevoUsuario = await tx.prisma.create({
        nombre,
        apellidoPaterno,
        apellidoMaterno,
        email: email.toLowerCase(),
        password: hashedPassword,
        rol: "DOCENTE",
        activo: true,
      });

      const nuevoDocente = await tx.prisma.create({
        data: {
          numeroEmpleado,
          uusuarioId: nuevoUsuario.idUsuario,
        },
      });

      return { usuario: nuevoUsuario, docente: nuevoDocente };
    });

    res.status(201).json({
      mensaje: "Docente registrado",
      datos: {
        nombre: resultado.docente.nombre,
        email: resultado.docente.email,
        numeroEmpleado: resultado.docente.numeroEmpleado,
      },
    });
  } catch (error) {
    console.error(error);
    if (error.code === "P2002") {
      return res.status(400).json({ error: "Docente ya registrado" });
    }
    res.status(500).json({ error: "Error al registrar" });
  }
};

const getDocentes = async (req, res) => {
  try {
    const docentes = await prisma.docente.findMany({
      include: {
        usuario: {
          select: {
            nombre: true,
            apellidoPaterno: true,
            apellidoMaterno: true,
            email: true,
            activo: true,
          },
        },
        _count: {
          select: { clases: true },
        },
      },
    });
    res.json(docentes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener al docente" });
  }
};

const cargarDocentesMasivos = async (req, res) => {
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

      if (!nombreExcel || !numEmpleadoExcel || !curpExcel) {
        errores.push({
          numeroEmpleado: "Desc",
          error: "Fila vacia o sin datos clave (Nombre, Num Empleado o CURP)",
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
              email: emailExcel.trim(),
              curp: curpExcel.trim().toUpperCase(),
              password: hashedPassword,
              rol: "DOCENTE",
              activo: true,
            },
          });

          await tx.docente.create({
            data: {
              numeroEmpleado: String(numEmpleadoExcel),
              usuarioId: nuevoUsuario.idUsuario,
            },
          });
        });

        datosInsertados.push(numEmpleadoExcel);
      } catch (error) {
        console.error(`Error con ${numEmpleadoExcel}: `, error);
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
module.exports = { crearDocente, getDocentes, cargarDocentesMasivos };
