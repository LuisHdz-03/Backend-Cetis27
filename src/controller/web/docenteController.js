const prisma = require("../../config/prisma");
const bcrypt = require("bcryptjs");
const XLSX = require("xlsx");

// logica para limpiar la matricula
const limpiarMatricula = (valor) => {
  const numStr = String(valor);
  if (/[eE]/.test(numStr)) {
    return parseFloat(numStr).toFixed(0);
  }
  return numStr.trim();
};

// se calcula la fecha de naciento con la curp
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

// Función para extraer fecha en formato AA/MM/DD desde CURP (para password inicial)
const extraerFechaPasswordDesdeCURP = (curp) => {
  if (!curp || curp.length < 10) return null;
  try {
    const aa = curp.substring(4, 6);
    const mm = curp.substring(6, 8);
    const dd = curp.substring(8, 10);
    return `${aa}${mm}${dd}`;
  } catch (e) {
    return null;
  }
};

// controladores

const crearDocente = async (req, res) => {
  try {
    const {
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      curp,
      numeroEmpleado,
      password,
      email,
      telefono,
      direccion,
      idEspecialidad,
      fechaContratacion,
    } = req.body;

    const numEmpleadoLimpio = limpiarMatricula(numeroEmpleado);
    const fechaNac = extraerFechaDesdeCURP(curp);
    const usernameGenerado = numEmpleadoLimpio;
    const emailNormalizado = email ? email.trim().toLowerCase() : null;
    const passwordInicial = extraerFechaPasswordDesdeCURP(curp);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(passwordInicial, salt);

    const resultado = await prisma.$transaction(async (tx) => {
      const nuevoUsuario = await tx.usuario.create({
        data: {
          nombre,
          apellidoPaterno,
          apellidoMaterno,
          username: usernameGenerado,
          email: emailNormalizado,
          curp: curp.trim().toUpperCase(),
          fechaNacimiento: fechaNac,
          password: hashedPassword,
          telefono,
          direccion,
          rol: "DOCENTE",
          activo: true,
          passwordChangeRequired: true,
        },
      });

      const nuevoDocente = await tx.docente.create({
        data: {
          numeroEmpleado: numEmpleadoLimpio,
          usuarioId: nuevoUsuario.idUsuario,
          especialidadId: idEspecialidad ? parseInt(idEspecialidad) : null,
          fechaContratacion: fechaContratacion
            ? new Date(fechaContratacion)
            : null,
        },
      });

      return { usuario: nuevoUsuario, docente: nuevoDocente };
    });

    res.status(201).json({
      ok: true,
      mensaje: "Docente registrado con éxito",
      credenciales: {
        username: resultado.usuario.username,
        password_inicial: passwordInicial,
        aviso: "El usuario debe cambiar la contraseña en el primer inicio de sesión.",
      },
      datos: {
        nombre: resultado.usuario.nombre,
        username: resultado.usuario.username,
        numeroEmpleado: resultado.docente.numeroEmpleado,
      },
    });
  } catch (error) {
    console.error(error);
    if (error.code === "P2002") {
      return res.status(400).json({
        ok: false,
        error: "La CURP, Username, Email o Número de Empleado ya existe",
      });
    }
    console.error(error);
    res.status(500).json({ ok: false, error: "Error al registrar docente" });
  }
};

const getDocentes = async (req, res) => {
  try {
    const docentes = await prisma.docente.findMany({
      include: {
        usuario: true,
        especialidad: true,
        clases: {
          include: {
            materias: true,
            grupo: true,
          },
        },
      },
    });

    // Transformamos los datos para que el Frontend los reciba aplanados
    const dataFormateada = docentes.map((d) => ({
      id: d.idDocente,
      nombre: d.usuario?.nombre,
      apellidoPaterno: d.usuario?.apellidoPaterno || "",
      apellidoMaterno: d.usuario?.apellidoMaterno || "",
      username: d.usuario?.username || "N/A",
      email: d.usuario?.email || "N/A",
      curp: d.usuario?.curp || "N/A",
      telefono: d.usuario?.telefono || "N/A",
      numeroEmpleado: d.numeroEmpleado || "N/A",
      especialidad: d.especialidad?.nombre || "Sin Asignar",
      fechaContratacion: d.fechaContratacion,
      activo: d.usuario?.activo ?? true,
    }));

    res.json(dataFormateada);
  } catch (error) {
    console.error("ERROR DETECTADO EN DOCENTES:", error);
    res.status(500).json({
      ok: false,
      error:
        "Error interno: Revisa que todos los docentes tengan un usuario vinculado.",
    });
  }
};

const cargarDocentesMasivos = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ ok: false, msg: "No se subió ningún archivo" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const datosExcel = XLSX.utils.sheet_to_json(sheet);

    const errores = [];
    const datosInsertados = [];

    for (const fila of datosExcel) {
      const nombreExcel = fila["NOMBRE"];
      const paternoExcel = fila["PATERNO"];
      const maternoExcel = fila["MATERNO"];
      const curpExcel = fila["CURP"];
      const numEmpleadoExcel = fila["NUM EMPLEADO"];

      if (!nombreExcel || !numEmpleadoExcel || !curpExcel) {
        errores.push({
          numeroEmpleado: numEmpleadoExcel || "Desconocido",
          error: "Fila incompleta (Faltan Nombre, CURP o Número de Empleado)",
        });
        continue;
      }

      try {
        const numEmpleadoLimpio = limpiarMatricula(numEmpleadoExcel);
        const fechaNac = extraerFechaDesdeCURP(curpExcel);
        const usernameGenerado = numEmpleadoLimpio;
        const passwordInicial = extraerFechaPasswordDesdeCURP(curpExcel);
        const emailExcel = fila["EMAIL"];
        const emailNormalizado = emailExcel ? String(emailExcel).trim().toLowerCase() : null;

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(passwordInicial, salt);

        await prisma.$transaction(async (tx) => {
          // Buscar si ya existe un docente con ese número de empleado
          const docenteExistente = await tx.docente.findFirst({
            where: { numeroEmpleado: numEmpleadoLimpio },
            include: { usuario: true },
          });

          if (docenteExistente) {
            // Si existe, actualizar solo los campos que sean diferentes
            const usuarioUpdate = {};
            if (nombreExcel !== docenteExistente.usuario.nombre)
              usuarioUpdate.nombre = nombreExcel;
            if (
              (paternoExcel || "") !== docenteExistente.usuario.apellidoPaterno
            )
              usuarioUpdate.apellidoPaterno = paternoExcel || "";
            if (
              (maternoExcel || "") !== docenteExistente.usuario.apellidoMaterno
            )
              usuarioUpdate.apellidoMaterno = maternoExcel || "";
            if (
              curpExcel.trim().toUpperCase() !== docenteExistente.usuario.curp
            ) {
              usuarioUpdate.curp = curpExcel.trim().toUpperCase();
              usuarioUpdate.username = usernameGenerado;
            }
            if (emailNormalizado !== docenteExistente.usuario.email)
              usuarioUpdate.email = emailNormalizado;
            if (
              fechaNac &&
              fechaNac.getTime() !==
                docenteExistente.usuario.fechaNacimiento?.getTime()
            )
              usuarioUpdate.fechaNacimiento = fechaNac;

            // Actualizar usuario si hay cambios
            if (Object.keys(usuarioUpdate).length > 0) {
              await tx.usuario.update({
                where: { idUsuario: docenteExistente.usuarioId },
                data: usuarioUpdate,
              });
            }
          } else {
            // Si no existe, crear nuevo
            const nuevoUsuario = await tx.usuario.create({
              data: {
                nombre: nombreExcel,
                apellidoPaterno: paternoExcel || "",
                apellidoMaterno: maternoExcel || "",
                username: usernameGenerado,
                email: emailNormalizado,
                curp: curpExcel.trim().toUpperCase(),
                fechaNacimiento: fechaNac,
                password: hashedPassword,
                rol: "DOCENTE",
                activo: true,
                passwordChangeRequired: true,
              },
            });

            await tx.docente.create({
              data: {
                numeroEmpleado: numEmpleadoLimpio,
                usuarioId: nuevoUsuario.idUsuario,
              },
            });
          }
        });

        datosInsertados.push(numEmpleadoLimpio);
      } catch (error) {
        console.error(`Error con el docente ${numEmpleadoExcel}: `, error);
        let msg = "Error al procesar la fila";
        if (error.code === "P2002")
          msg = "Docente duplicado (CURP/Username/Email/Número Empleado)";
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
    res.status(500).json({ ok: false, msg: "Error interno del servidor" });
  }
};
const eliminarDocente = async (req, res) => {
  try {
    const { id } = req.params;
    const docenteId = parseInt(id);

    if (isNaN(docenteId)) {
      return res
        .status(400)
        .json({ ok: false, error: "ID de docente inválido" });
    }

    const docente = await prisma.docente.findUnique({
      where: { idDocente: docenteId },
    });

    if (!docente) {
      return res
        .status(404)
        .json({ ok: false, error: "Docente no encontrado" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.docente.delete({
        where: { idDocente: docenteId },
      });

      await tx.usuario.delete({
        where: { idUsuario: docente.usuarioId },
      });
    });

    res.json({ ok: true, mensaje: "Docente eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar docente:", error);

    if (error.code === "P2003") {
      return res.status(400).json({
        ok: false,
        error:
          "No se puede eliminar el docente porque tiene materias o clases asignadas.",
      });
    }

    res.status(500).json({
      ok: false,
      error: "Error interno al intentar eliminar al docente",
    });
  }
};

const actualizarDocente = async (req, res) => {
  try {
    const { id } = req.params;
    const docenteId = parseInt(id);

    if (isNaN(docenteId)) {
      return res
        .status(400)
        .json({ ok: false, error: "ID de docente inválido" });
    }

    const docenteActual = await prisma.docente.findUnique({
      where: { idDocente: docenteId },
    });

    if (!docenteActual) {
      return res
        .status(404)
        .json({ ok: false, error: "Docente no encontrado" });
    }

    const {
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      curp,
      numeroEmpleado,
      password,
      activo,
      email,
      telefono,
      direccion,
      idEspecialidad,
      fechaContratacion,
    } = req.body;

    const usuarioData = {};
    if (nombre) usuarioData.nombre = nombre;
    if (apellidoPaterno !== undefined)
      usuarioData.apellidoPaterno = apellidoPaterno;
    if (apellidoMaterno !== undefined)
      usuarioData.apellidoMaterno = apellidoMaterno;
    if (telefono !== undefined) usuarioData.telefono = telefono;
    if (direccion !== undefined) usuarioData.direccion = direccion;
    if (activo !== undefined) usuarioData.activo = activo;

    if (curp) {
      usuarioData.curp = curp.trim().toUpperCase();
      const numeroEmpleadoParaUsername = numeroEmpleado
        ? limpiarMatricula(numeroEmpleado)
        : docenteActual.numeroEmpleado;
      usuarioData.username = numeroEmpleadoParaUsername;
      usuarioData.fechaNacimiento = extraerFechaDesdeCURP(curp);
    }
    if (email !== undefined) {
      usuarioData.email = email ? email.trim().toLowerCase() : null;
    }

    if (password) {
      const salt = await bcrypt.genSalt(10);
      usuarioData.password = await bcrypt.hash(password, salt);
    }

    const docenteData = {};
    if (numeroEmpleado) {
      docenteData.numeroEmpleado = limpiarMatricula(numeroEmpleado);
    }

    if (idEspecialidad !== undefined) {
      docenteData.especialidadId = idEspecialidad
        ? parseInt(idEspecialidad)
        : null;
    }

    if (fechaContratacion !== undefined) {
      docenteData.fechaContratacion = fechaContratacion
        ? new Date(fechaContratacion)
        : null;
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(usuarioData).length > 0) {
        await tx.usuario.update({
          where: { idUsuario: docenteActual.usuarioId },
          data: usuarioData,
        });
      }

      if (Object.keys(docenteData).length > 0) {
        await tx.docente.update({
          where: { idDocente: docenteId },
          data: docenteData,
        });
      }
    });

    res.json({ ok: true, mensaje: "Docente actualizado correctamente" });
  } catch (error) {
    console.error("Error al actualizar docente:", error);

    if (error.code === "P2002") {
      return res.status(400).json({
        ok: false,
        error:
          "La CURP, Username, Email o Número de Empleado ya están en uso por otro registro.",
      });
    }

    res.status(500).json({
      ok: false,
      error: "Error interno al intentar actualizar al docente",
    });
  }
};

const descargarPlantillaDocentes = async (req, res) => {
  try {
    const filasEjemplo = [
      {
        "NUM EMPLEADO": "DOC001",
        NOMBRE: "MARIA",
        PATERNO: "GOMEZ",
        MATERNO: "LOPEZ",
        CURP: "GOLM850101MDFRPR01",
        EMAIL: "docente@correo.com",
      },
    ];

    const instrucciones = [
      { CAMPO: "NUM EMPLEADO", DESCRIPCION: "Numero de empleado (obligatorio)" },
      { CAMPO: "NOMBRE", DESCRIPCION: "Nombre del docente (obligatorio)" },
      { CAMPO: "PATERNO", DESCRIPCION: "Apellido paterno (opcional)" },
      { CAMPO: "MATERNO", DESCRIPCION: "Apellido materno (opcional)" },
      { CAMPO: "CURP", DESCRIPCION: "CURP (obligatorio)" },
      { CAMPO: "EMAIL", DESCRIPCION: "Correo electronico (opcional)" },
    ];

    const wb = XLSX.utils.book_new();
    const wsEjemplo = XLSX.utils.json_to_sheet(filasEjemplo);
    const wsInstrucciones = XLSX.utils.json_to_sheet(instrucciones);
    XLSX.utils.book_append_sheet(wb, wsEjemplo, "Plantilla_Docentes");
    XLSX.utils.book_append_sheet(wb, wsInstrucciones, "Instrucciones");

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="plantilla_docentes.xlsx"',
    );

    return res.send(buffer);
  } catch (error) {
    console.error("Error al generar plantilla de docentes:", error);
    return res
      .status(500)
      .json({ error: "Error al generar plantilla de docentes" });
  }
};
module.exports = {
  crearDocente,
  getDocentes,
  cargarDocentesMasivos,
  eliminarDocente,
  actualizarDocente,
  descargarPlantillaDocentes,
};
