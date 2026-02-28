const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const XLSX = require("xlsx");
const prisma = new PrismaClient();

const limpiarMatricula = (valor) => {
  const numStr = String(valor);
  if (/[eE]/.test(numStr)) {
    return parseFloat(numStr).toFixed(0);
  }
  return numStr.trim();
};

const extraerFechaDesdeCURP = (curp) => {
  if (!curp || curp.length < 10) return null;
  try {
    const aa = curp.substring(4, 6);
    const mm = curp.substring(6, 8);
    const dd = curp.substring(8, 10);
    const year = parseInt(aa);
    const fullYear = year <= 30 ? 2000 + year : 1900 + year;
    const fecha = new Date(`${fullYear}-${mm}-${dd}`);
    return isNaN(fecha.getTime()) ? null : fecha;
  } catch (e) {
    return null;
  }
};

// controladores

const crearAdministrativo = async (req, res) => {
  try {
    const {
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      curp,
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
        error: `El rol '${rolAsignar}' no es válido. Usa: ${rolesPermitidos.join(", ")}`,
      });
    }

    const numEmpleadoLimpio = limpiarMatricula(numeroEmpleado);
    const fechaNac = extraerFechaDesdeCURP(curp);
    const emailGenerado = `${curp.substring(0, 10).toLowerCase()}@admin.cetis27.edu.mx`;

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(
      password || numEmpleadoLimpio,
      salt,
    );

    const nuevoAdmin = await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          nombre,
          apellidoPaterno,
          apellidoMaterno,
          email: emailGenerado,
          curp: curp.trim().toUpperCase(),
          fechaNacimiento: fechaNac,
          password: hashedPassword,
          rol: rolAsignar,
          activo: true,
        },
      });

      const perfil = await tx.administrativo.create({
        data: {
          numeroEmpleado: numEmpleadoLimpio,
          cargo,
          area,
          usuarioId: usuario.idUsuario,
        },
      });

      return { usuario, perfil };
    });

    res.status(201).json({
      ok: true,
      mensaje: `Personal registrado correctamente como ${rolAsignar}`,
      data: nuevoAdmin,
    });
  } catch (error) {
    console.error(error);
    if (error.code === "P2002") {
      return res.status(400).json({
        ok: false,
        error: "La CURP, Email o Número de Empleado ya existe",
      });
    }
    res.status(500).json({ ok: false, error: "Error al registrar personal." });
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
            apellidoMaterno: true,
            email: true,
            curp: true,
            fechaNacimiento: true,
            rol: true,
            activo: true,
          },
        },
      },
    });

    const dataFormateada = admins.map((a) => ({
      id: a.idAdministrativo,
      nombre: `${a.usuario.nombre} ${a.usuario.apellidoPaterno} ${a.usuario.apellidoMaterno}`,
      email: a.usuario.email,
      cargo: a.cargo,
      area: a.area,
      numEmpleado: a.numeroEmpleado,
      rol: a.usuario.rol,
      activo: a.usuario.activo,
    }));

    res.json(dataFormateada);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener lista." });
  }
};

const cargarAdministrativosMasivos = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, msg: "No se subió archivo" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const datosExcel = XLSX.utils.sheet_to_json(sheet);

    const errores = [];
    const datosInsertados = [];

    for (const fila of datosExcel) {
      const nombreExcel = fila["NOMBRE"];
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
            "Faltan datos obligatorios (Nombre, CURP, Num Empleado, Cargo o Área)",
        });
        continue;
      }

      try {
        const numEmpleadoLimpio = limpiarMatricula(numEmpleadoExcel);
        const fechaNac = extraerFechaDesdeCURP(curpExcel);
        const emailGenerado = `${curpExcel.substring(0, 10).toLowerCase()}@admin.cetis27.edu.mx`;

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(
          String(numEmpleadoLimpio),
          salt,
        );

        await prisma.$transaction(async (tx) => {
          const nuevoUsuario = await tx.usuario.create({
            data: {
              nombre: nombreExcel,
              apellidoPaterno: fila["PATERNO"] || "",
              apellidoMaterno: fila["MATERNO"] || "",
              email: emailGenerado,
              curp: curpExcel.trim().toUpperCase(),
              fechaNacimiento: fechaNac,
              password: hashedPassword,
              rol: "ADMINISTRATIVO",
              activo: true,
            },
          });

          await tx.administrativo.create({
            data: {
              numeroEmpleado: numEmpleadoLimpio,
              cargo: cargoExcel,
              area: areaExcel,
              usuarioId: nuevoUsuario.idUsuario,
            },
          });
        });

        datosInsertados.push(numEmpleadoLimpio);
      } catch (error) {
        console.error(`Error con administrativo ${numEmpleadoExcel}: `, error);
        let msg = "Error al procesar la fila";
        if (error.code === "P2002")
          msg = "Dato duplicado (CURP/Email/Num Empleado)";
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

const asignarMateria = async (req, res) => {
  try {
    const { docenteId, materiaId, grupoId, periodoId, horario } = req.body;

    const nuevaClase = await prisma.clase.create({
      data: {
        docenteId: parseInt(docenteId),
        materiaId: parseInt(materiaId),
        grupoId: parseInt(grupoId),
        periodoId: parseInt(periodoId),
        horario: horario,
      },
    });

    res.status(201).json({
      ok: true,
      msg: "Materia asignada correctamente",
      clase: nuevaClase,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, msg: "Error al realizar la asignación" });
  }
};

module.exports = {
  crearAdministrativo,
  getAdministrativos,
  cargarAdministrativosMasivos,
  asignarMateria,
};
