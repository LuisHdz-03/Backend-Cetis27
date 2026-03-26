const prisma = require("../../config/prisma");
const bcrypt = require("bcryptjs");
const XLSX = require("xlsx");

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

// Cargos permitidos para personal administrativo
const cargosPermitidos = [
  "DIRECTOR",
  "SUBDIRECTORA ACADEMICA",
  "COORDINADOR",
  "JEFE DE DEPARTAMENTO",
  "SECRETARIO",
  "TESORERO",
  "PREFECTO",
];

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
      telefono,
    } = req.body;

    const rolesPermitidos = ["ADMINISTRATIVO", "DIRECTIVO", "GUARDIA"];
    const rolAsignar = rol ? rol.toUpperCase() : "ADMINISTRATIVO";

    if (!rolesPermitidos.includes(rolAsignar)) {
      return res.status(400).json({
        error: `El rol '${rolAsignar}' no es válido. Usa: ${rolesPermitidos.join(", ")}`,
      });
    }

    // Validar cargo permitido
    const cargoNormalizado = cargo.trim().toUpperCase();
    if (!cargosPermitidos.includes(cargoNormalizado)) {
      return res.status(400).json({
        error: `El cargo '${cargo}' no es válido. Cargos permitidos: ${cargosPermitidos.join(", ")}`,
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
          telefono,
        },
      });

      const perfil = await tx.administrativo.create({
        data: {
          numeroEmpleado: numeroEmpleado ? numEmpleadoLimpio : null,
          cargo: cargoNormalizado,
          area: area || "Administración General",
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
            telefono: true,
            fechaNacimiento: true,
            rol: true,
            activo: true,
          },
        },
      },
    });

    const dataFormateada = admins.map((a) => ({
      id: a.idAdministrativo,
      nombre: a.usuario.nombre,
      apellidoPaterno: a.usuario.apellidoPaterno,
      apellidoMaterno: a.usuario.apellidoMaterno,
      telefono: a.usuario.telefono,
      curp: a.usuario.curp,
      email: a.usuario.email,
      cargo: a.cargo,
      area: a.area,
      numeroEmpleado: a.numeroEmpleado,
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

      // Validar cargo permitido
      const cargoNormalizado = String(cargoExcel).trim().toUpperCase();
      if (!cargosPermitidos.includes(cargoNormalizado)) {
        errores.push({
          numeroEmpleado: numEmpleadoExcel,
          error: `Cargo inválido: '${cargoExcel}'. Cargos permitidos: ${cargosPermitidos.join(", ")}`,
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
          // Buscar si ya existe un administrativo con ese número de empleado
          const administrativoExistente = await tx.administrativo.findFirst({
            where: { numeroEmpleado: numEmpleadoLimpio },
            include: { usuario: true },
          });

          if (administrativoExistente) {
            // Si existe, actualizar solo los campos que sean diferentes
            const usuarioUpdate = {};
            if (nombreExcel !== administrativoExistente.usuario.nombre)
              usuarioUpdate.nombre = nombreExcel;
            if (
              (fila["PATERNO"] || "") !==
              administrativoExistente.usuario.apellidoPaterno
            )
              usuarioUpdate.apellidoPaterno = fila["PATERNO"] || "";
            if (
              (fila["MATERNO"] || "") !==
              administrativoExistente.usuario.apellidoMaterno
            )
              usuarioUpdate.apellidoMaterno = fila["MATERNO"] || "";
            if (
              curpExcel.trim().toUpperCase() !==
              administrativoExistente.usuario.curp
            )
              usuarioUpdate.curp = curpExcel.trim().toUpperCase();
            if (emailGenerado !== administrativoExistente.usuario.email)
              usuarioUpdate.email = emailGenerado;
            if (
              fechaNac &&
              fechaNac.getTime() !==
                administrativoExistente.usuario.fechaNacimiento?.getTime()
            )
              usuarioUpdate.fechaNacimiento = fechaNac;

            // Actualizar usuario si hay cambios
            if (Object.keys(usuarioUpdate).length > 0) {
              await tx.usuario.update({
                where: { idUsuario: administrativoExistente.usuarioId },
                data: usuarioUpdate,
              });
            }

            // Actualizar administrativo si hay cambios
            const adminUpdate = {};
            if (cargoNormalizado !== administrativoExistente.cargo)
              adminUpdate.cargo = cargoNormalizado;
            if (areaExcel !== administrativoExistente.area)
              adminUpdate.area = areaExcel;

            if (Object.keys(adminUpdate).length > 0) {
              await tx.administrativo.update({
                where: {
                  idAdministrativo: administrativoExistente.idAdministrativo,
                },
                data: adminUpdate,
              });
            }
          } else {
            // Si no existe, crear nuevo
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
                cargo: cargoNormalizado,
                area: areaExcel,
                usuarioId: nuevoUsuario.idUsuario,
              },
            });
          }
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

const actualizarAdministrativo = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      curp,
      cargo,
      area,
      numeroEmpleado,
      telefono,
      activo,
    } = req.body;

    const adminId = parseInt(id);

    if (isNaN(adminId)) {
      return res
        .status(400)
        .json({ ok: false, error: "ID de administrador inválido" });
    }

    // Buscar el administrativo para obtener el usuarioId
    const admin = await prisma.administrativo.findUnique({
      where: { idAdministrativo: adminId },
      include: { usuario: true },
    });

    if (!admin) {
      return res
        .status(404)
        .json({ ok: false, error: "Administrador no encontrado" });
    }

    // Validar cargo si se proporciona
    if (cargo) {
      const cargoNormalizado = cargo.trim().toUpperCase();
      if (!cargosPermitidos.includes(cargoNormalizado)) {
        return res.status(400).json({
          error: `El cargo '${cargo}' no es válido. Cargos permitidos: ${cargosPermitidos.join(", ")}`,
        });
      }
    }

    // Actualizar en transacción
    const actualizado = await prisma.$transaction(async (tx) => {
      // Actualizar usuario si hay cambios
      const usuarioData = {};
      if (nombre !== undefined) usuarioData.nombre = nombre;
      if (apellidoPaterno !== undefined)
        usuarioData.apellidoPaterno = apellidoPaterno;
      if (apellidoMaterno !== undefined)
        usuarioData.apellidoMaterno = apellidoMaterno;
      if (curp !== undefined) usuarioData.curp = curp.trim().toUpperCase();
      if (telefono !== undefined) usuarioData.telefono = telefono;
      if (activo !== undefined) usuarioData.activo = activo;

      let usuarioActualizado = admin.usuario;
      if (Object.keys(usuarioData).length > 0) {
        usuarioActualizado = await tx.usuario.update({
          where: { idUsuario: admin.usuarioId },
          data: usuarioData,
        });
      }

      // Actualizar administrativo si hay cambios
      const adminData = {};
      if (cargo !== undefined) adminData.cargo = cargo.trim().toUpperCase();
      if (area !== undefined) adminData.area = area;
      if (numeroEmpleado !== undefined)
        adminData.numeroEmpleado = limpiarMatricula(numeroEmpleado);

      let adminActualizado = admin;
      if (Object.keys(adminData).length > 0) {
        adminActualizado = await tx.administrativo.update({
          where: { idAdministrativo: adminId },
          data: adminData,
        });
      }

      return { usuario: usuarioActualizado, administrativo: adminActualizado };
    });

    res.json({
      ok: true,
      mensaje: "Administrador actualizado correctamente",
      data: actualizado,
    });
  } catch (error) {
    console.error("Error al actualizar administrador:", error);

    if (error.code === "P2002") {
      return res.status(400).json({
        ok: false,
        error: "La CURP o Email ya está en uso por otro usuario",
      });
    }

    res.status(500).json({
      ok: false,
      error: "Error interno al intentar actualizar al administrador",
    });
  }
};

const eliminarAdministrativo = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = parseInt(id);

    if (isNaN(adminId)) {
      return res
        .status(400)
        .json({ ok: false, error: "ID de administrador inválido" });
    }

    // 1. Buscamos al administrador para saber cuál es su usuarioId
    const admin = await prisma.administrativo.findUnique({
      where: { idAdministrativo: adminId },
    });

    if (!admin) {
      return res
        .status(404)
        .json({ ok: false, error: "Administrador no encontrado" });
    }

    // 2. Eliminamos en cascada (Administrativo y luego Usuario) usando una transacción
    await prisma.$transaction(async (tx) => {
      // Primero borramos el registro hijo (administrativo)
      await tx.administrativo.delete({
        where: { idAdministrativo: adminId },
      });

      // Luego borramos el registro padre (usuario)
      await tx.usuario.delete({
        where: { idUsuario: admin.usuarioId },
      });
    });

    res.json({ ok: true, mensaje: "Administrador eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar administrador:", error);

    // Código P2003: Falla de llave foránea
    if (error.code === "P2003") {
      return res.status(400).json({
        ok: false,
        error:
          "No se puede eliminar porque este administrador tiene dependencias asignadas.",
      });
    }

    res.status(500).json({
      ok: false,
      error: "Error interno al intentar eliminar al administrador",
    });
  }
};

module.exports = {
  crearAdministrativo,
  getAdministrativos,
  cargarAdministrativosMasivos,
  asignarMateria,
  actualizarAdministrativo,
  eliminarAdministrativo,
};
