const prisma = require("../../config/prisma");
const bcrypt = require("bcryptjs");
const XLSX = require("xlsx");

const limpiarMatricula = (valor) => {
  if (valor === undefined || valor === null) return null;
  const numStr = String(valor).trim();

  if (/^\d+(\.\d+)?[eE][+\-]?\d+$/.test(numStr)) {
    const numeroConvertido = parseFloat(numStr);
    if (!isNaN(numeroConvertido)) {
      return numeroConvertido.toFixed(0);
    }
  }

  return numStr;
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

const extraerFechaPasswordDesdeCURP = (curp) => {
  if (!curp || curp.length < 10) return null;
  try {
    const aa = curp.substring(4, 6);
    const mm = curp.substring(6, 8);
    const dd = curp.substring(8, 10);
    return `${aa}/${mm}/${dd}`;
  } catch (e) {
    return null;
  }
};

const normalizarTexto = (valor) =>
  String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

const cargosFront = [
  "Director",
  "Subdirector Académica",
  "Coordinador",
  "Jefe de Departamento",
  "Secretario",
  "Prefecto",
];

const cargosPermitidos = cargosFront.map((c) => normalizarTexto(c));

const cargoParaMostrar = {
  DIRECTOR: "Director",
  "SUBDIRECTORA ACADEMICA": "Subdirectora Académica",
  COORDINADOR: "Coordinador",
  "JEFE DE DEPARTAMENTO": "Jefe de Departamento",
  SECRETARIO: "Secretario",
  PREFECTO: "Prefecto",
};

const rolPorCargo = {
  DIRECTOR: "DIRECTIVO",
  "SUBDIRECTORA ACADEMICA": "DIRECTIVO",
  COORDINADOR: "ADMINISTRATIVO",
  "JEFE DE DEPARTAMENTO": "ADMINISTRATIVO",
  SECRETARIO: "ADMINISTRATIVO",
  PREFECTO: "PREFECTO",
};

const normalizarCargo = (cargo) => {
  const cargoNormalizado = normalizarTexto(cargo);
  return cargosPermitidos.includes(cargoNormalizado) ? cargoNormalizado : null;
};

const obtenerRolDesdeCargo = (cargoNormalizado) =>
  rolPorCargo[cargoNormalizado] || "ADMINISTRATIVO";

const validarDirectorUnicoActivo = async (
  tx,
  cargoNormalizado,
  excludeAdminId = null,
) => {
  if (cargoNormalizado !== "DIRECTOR") return;

  const whereDirector = {
    cargo: "DIRECTOR",
    usuario: { activo: true },
  };

  if (excludeAdminId) {
    whereDirector.idAdministrativo = { not: excludeAdminId };
  }

  const directorActivo = await tx.administrativo.findFirst({
    where: whereDirector,
    select: { idAdministrativo: true },
  });

  if (directorActivo) {
    const error = new Error("DIRECTOR_ACTIVO_DUPLICADO");
    error.code = "DIRECTOR_ACTIVO_DUPLICADO";
    throw error;
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
      email,
      telefono,
    } = req.body;

    // Validar cargo permitido
    const cargoNormalizado = normalizarCargo(cargo);
    if (!cargoNormalizado) {
      return res.status(400).json({
        error: `El cargo '${cargo}' no es válido. Cargos permitidos: ${cargosFront.join(", ")}`,
      });
    }

    const rolAsignar = obtenerRolDesdeCargo(cargoNormalizado);

    const numEmpleadoLimpio = limpiarMatricula(numeroEmpleado);
    const fechaNac = extraerFechaDesdeCURP(curp);
    const usernameGenerado = numEmpleadoLimpio;
    const emailNormalizado = email ? email.trim().toLowerCase() : null;
    const passwordInicial = extraerFechaPasswordDesdeCURP(curp);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(passwordInicial, salt);

    const nuevoAdmin = await prisma.$transaction(async (tx) => {
      await validarDirectorUnicoActivo(tx, cargoNormalizado);

      const usuario = await tx.usuario.create({
        data: {
          nombre,
          apellidoPaterno,
          apellidoMaterno,
          username: usernameGenerado,
          email: emailNormalizado,
          curp: curp.trim().toUpperCase(),
          fechaNacimiento: fechaNac,
          password: hashedPassword,
          rol: rolAsignar,
          activo: true,
          telefono,
          passwordChangeRequired: true,
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
      mensaje: `Personal registrado correctamente como ${rolAsignar} (${cargoParaMostrar[cargoNormalizado] || cargoNormalizado})`,
      credenciales: {
        username: nuevoAdmin.usuario.username,
        password_inicial: passwordInicial,
        aviso:
          "El usuario debe cambiar la contraseña en el primer inicio de sesión.",
      },
      data: nuevoAdmin,
    });
  } catch (error) {
    console.error(error);
    if (error.code === "P2002") {
      return res.status(400).json({
        ok: false,
        error: "La CURP, Username, Email o Número de Empleado ya existe",
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
            username: true,
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
      username: a.usuario.username,
      telefono: a.usuario.telefono,
      curp: a.usuario.curp,
      email: a.usuario.email,
      cargo: cargoParaMostrar[a.cargo] || a.cargo,
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
      const cargoNormalizado = normalizarCargo(cargoExcel);
      if (!cargoNormalizado) {
        errores.push({
          numeroEmpleado: numEmpleadoExcel,
          error: `Cargo inválido: '${cargoExcel}'. Cargos permitidos: ${cargosFront.join(", ")}`,
        });
        continue;
      }

      const rolAsignar = obtenerRolDesdeCargo(cargoNormalizado);

      try {
        const numEmpleadoLimpio = limpiarMatricula(numEmpleadoExcel);
        const fechaNac = extraerFechaDesdeCURP(curpExcel);
        const usernameGenerado = numEmpleadoLimpio;
        const passwordInicial = extraerFechaPasswordDesdeCURP(curpExcel);
        const emailExcel = fila["EMAIL"];
        const emailNormalizado = emailExcel
          ? String(emailExcel).trim().toLowerCase()
          : null;

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(passwordInicial, salt);

        await prisma.$transaction(async (tx) => {
          // Buscar si ya existe un administrativo con ese número de empleado
          const administrativoExistente = await tx.administrativo.findFirst({
            where: { numeroEmpleado: numEmpleadoLimpio },
            include: { usuario: true },
          });

          if (administrativoExistente) {
            const rolActualizado = obtenerRolDesdeCargo(cargoNormalizado);

            if (cargoNormalizado === "DIRECTOR") {
              await validarDirectorUnicoActivo(
                tx,
                cargoNormalizado,
                administrativoExistente.idAdministrativo,
              );
            }

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
            ) {
              usuarioUpdate.curp = curpExcel.trim().toUpperCase();
              usuarioUpdate.username = usernameGenerado;
            }
            if (emailNormalizado !== administrativoExistente.usuario.email)
              usuarioUpdate.email = emailNormalizado;
            if (
              fechaNac &&
              fechaNac.getTime() !==
                administrativoExistente.usuario.fechaNacimiento?.getTime()
            )
              usuarioUpdate.fechaNacimiento = fechaNac;
            if (administrativoExistente.usuario.rol !== rolActualizado)
              usuarioUpdate.rol = rolActualizado;

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
            await validarDirectorUnicoActivo(tx, cargoNormalizado);

            const nuevoUsuario = await tx.usuario.create({
              data: {
                nombre: nombreExcel,
                apellidoPaterno: fila["PATERNO"] || "",
                apellidoMaterno: fila["MATERNO"] || "",
                username: usernameGenerado,
                email: emailNormalizado,
                curp: curpExcel.trim().toUpperCase(),
                fechaNacimiento: fechaNac,
                password: hashedPassword,
                rol: rolAsignar,
                activo: true,
                passwordChangeRequired: true,
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
          msg = "Dato duplicado (CURP/Username/Email/Num Empleado)";
        if (error.code === "DIRECTOR_ACTIVO_DUPLICADO")
          msg = "No puede existir más de un Director activo";
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
      email,
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
      const cargoNormalizado = normalizarCargo(cargo);
      if (!cargoNormalizado) {
        return res.status(400).json({
          error: `El cargo '${cargo}' no es válido. Cargos permitidos: ${cargosFront.join(", ")}`,
        });
      }
    }

    // Actualizar en transacción
    const actualizado = await prisma.$transaction(async (tx) => {
      const cargoResultante = cargo ? normalizarCargo(cargo) : admin.cargo;
      const activoResultante =
        activo !== undefined ? Boolean(activo) : admin.usuario.activo;

      if (cargoResultante === "DIRECTOR" && activoResultante) {
        await validarDirectorUnicoActivo(tx, cargoResultante, adminId);
      }

      // Actualizar usuario si hay cambios
      const usuarioData = {};
      if (nombre !== undefined) usuarioData.nombre = nombre;
      if (apellidoPaterno !== undefined)
        usuarioData.apellidoPaterno = apellidoPaterno;
      if (apellidoMaterno !== undefined)
        usuarioData.apellidoMaterno = apellidoMaterno;
      if (curp !== undefined) {
        usuarioData.curp = curp.trim().toUpperCase();
        const numeroEmpleadoParaUsername = numeroEmpleado
          ? limpiarMatricula(numeroEmpleado)
          : admin.numeroEmpleado;
        usuarioData.username = numeroEmpleadoParaUsername;
      }
      if (email !== undefined)
        usuarioData.email = email ? email.trim().toLowerCase() : null;
      if (telefono !== undefined) usuarioData.telefono = telefono;
      if (activo !== undefined) usuarioData.activo = activo;
      if (cargo !== undefined)
        usuarioData.rol = obtenerRolDesdeCargo(cargoResultante);

      let usuarioActualizado = admin.usuario;
      if (Object.keys(usuarioData).length > 0) {
        usuarioActualizado = await tx.usuario.update({
          where: { idUsuario: admin.usuarioId },
          data: usuarioData,
        });
      }

      // Actualizar administrativo si hay cambios
      const adminData = {};
      if (cargo !== undefined) adminData.cargo = cargoResultante;
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

    if (error.code === "DIRECTOR_ACTIVO_DUPLICADO") {
      return res.status(400).json({
        ok: false,
        error: "No puede existir más de un Director activo",
      });
    }

    if (error.code === "P2002") {
      return res.status(400).json({
        ok: false,
        error: "La CURP, Username o Email ya está en uso por otro usuario",
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

const descargarPlantillaAdministrativos = async (req, res) => {
  try {
    const filasEjemplo = [
      {
        "NUM EMPLEADO": "ADM001",
        NOMBRE: "LUIS",
        PATERNO: "HERNANDEZ",
        MATERNO: "RAMIREZ",
        CURP: "HERL820101HDFRMN01",
        CARGO: "COORDINADOR",
        AREA: "Control Escolar",
        EMAIL: "admin@correo.com",
      },
    ];

    const instrucciones = [
      {
        CAMPO: "NUM EMPLEADO",
        DESCRIPCION: "Numero de empleado (obligatorio)",
      },
      { CAMPO: "NOMBRE", DESCRIPCION: "Nombre (obligatorio)" },
      { CAMPO: "PATERNO", DESCRIPCION: "Apellido paterno (opcional)" },
      { CAMPO: "MATERNO", DESCRIPCION: "Apellido materno (opcional)" },
      { CAMPO: "CURP", DESCRIPCION: "CURP (obligatorio)" },
      {
        CAMPO: "CARGO",
        DESCRIPCION:
          "Cargo permitido: Director, Subdirectora Académica, Coordinador, Jefe de Departamento, Secretario, Prefecto",
      },
      { CAMPO: "AREA", DESCRIPCION: "Area de trabajo (obligatorio)" },
      { CAMPO: "EMAIL", DESCRIPCION: "Correo electronico (opcional)" },
    ];

    const wb = XLSX.utils.book_new();
    const wsEjemplo = XLSX.utils.json_to_sheet(filasEjemplo);
    const wsInstrucciones = XLSX.utils.json_to_sheet(instrucciones);
    XLSX.utils.book_append_sheet(wb, wsEjemplo, "Plantilla_Administrativos");
    XLSX.utils.book_append_sheet(wb, wsInstrucciones, "Instrucciones");

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="plantilla_administrativos.xlsx"',
    );

    return res.send(buffer);
  } catch (error) {
    console.error("Error al generar plantilla de administrativos:", error);
    return res
      .status(500)
      .json({ error: "Error al generar plantilla de administrativos" });
  }
};

module.exports = {
  crearAdministrativo,
  getAdministrativos,
  cargarAdministrativosMasivos,
  asignarMateria,
  actualizarAdministrativo,
  eliminarAdministrativo,
  descargarPlantillaAdministrativos,
};
