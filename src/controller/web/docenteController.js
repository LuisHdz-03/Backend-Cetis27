const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const XLSX = require("xlsx");
const prisma = new PrismaClient();

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
    } = req.body;

    const numEmpleadoLimpio = limpiarMatricula(numeroEmpleado);
    const fechaNac = extraerFechaDesdeCURP(curp);
    const emailGenerado = `${curp.substring(0, 10).toLowerCase()}@docentes.cetis27.edu.mx`;

    const passToHash = password || numEmpleadoLimpio;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(passToHash, salt);

    const resultado = await prisma.$transaction(async (tx) => {
      const nuevoUsuario = await tx.usuario.create({
        data: {
          nombre,
          apellidoPaterno,
          apellidoMaterno,
          email: emailGenerado,
          curp: curp.trim().toUpperCase(),
          fechaNacimiento: fechaNac,
          password: hashedPassword,
          rol: "DOCENTE",
          activo: true,
        },
      });

      const nuevoDocente = await tx.docente.create({
        data: {
          numeroEmpleado: numEmpleadoLimpio,
          usuarioId: nuevoUsuario.idUsuario,
        },
      });

      return { usuario: nuevoUsuario, docente: nuevoDocente };
    });

    res.status(201).json({
      ok: true,
      mensaje: "Docente registrado con éxito",
      datos: {
        nombre: resultado.usuario.nombre,
        email: resultado.usuario.email,
        numeroEmpleado: resultado.docente.numeroEmpleado,
      },
    });
  } catch (error) {
    console.error(error);
    if (error.code === "P2002") {
      return res.status(400).json({
        ok: false,
        error: "La CURP, Email o Número de Empleado ya existe",
      });
    }
    res.status(500).json({ ok: false, error: "Error al registrar docente" });
  }
};

const getDocentes = async (req, res) => {
  try {
    const docentes = await prisma.docente.findMany({
      include: {
        usuario: true, // Traemos el objeto completo para evitar errores de selección
        clases: {
          include: {
            materias: true,
            grupo: true,
          },
        },
      },
    });

    // Transformamos los datos para que el Frontend los reciba "aplanados"
    const dataFormateada = docentes.map((d) => ({
      id: d.idDocente,
      nombre: d.usuario?.nombre,
      apellidoPaterno: d.usuario?.apellidoPaterno || "",
      apellidoMaterno: d.usuario?.apellidoMaterno || "",
      email: d.usuario?.email || "N/A",
      curp: d.usuario?.curp || "N/A",
      telefono: d.usuario?.telefono || "N/A",
      numeroEmpleado: d.numeroEmpleado || "N/A",
      // Si quieres que no diga "Docente General", puedes sacar la especialidad real:
      especialidad: d.clases[0]?.materias?.nombre || "General",
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
        const emailGenerado = `${curpExcel.substring(0, 10).toLowerCase()}@docentes.cetis27.edu.mx`;

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(
          String(numEmpleadoLimpio),
          salt,
        );

        await prisma.$transaction(async (tx) => {
          const nuevoUsuario = await tx.usuario.create({
            data: {
              nombre: nombreExcel,
              apellidoPaterno: paternoExcel || "",
              apellidoMaterno: maternoExcel || "",
              email: emailGenerado,
              curp: curpExcel.trim().toUpperCase(),
              fechaNacimiento: fechaNac,
              password: hashedPassword,
              rol: "DOCENTE",
              activo: true,
            },
          });

          await tx.docente.create({
            data: {
              numeroEmpleado: numEmpleadoLimpio,
              usuarioId: nuevoUsuario.idUsuario,
            },
          });
        });

        datosInsertados.push(numEmpleadoLimpio);
      } catch (error) {
        console.error(`Error con el docente ${numEmpleadoExcel}: `, error);
        let msg = "Error al procesar la fila";
        if (error.code === "P2002")
          msg = "Docente duplicado (CURP/Email/Número Empleado)";
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
      telefono,
      direccion,
      idEspecialidad,
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
      usuarioData.fechaNacimiento = extraerFechaDesdeCURP(curp);
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
          "La CURP, Email o Número de Empleado ya están en uso por otro registro.",
      });
    }

    res.status(500).json({
      ok: false,
      error: "Error interno al intentar actualizar al docente",
    });
  }
};
module.exports = {
  crearDocente,
  getDocentes,
  cargarDocentesMasivos,
  eliminarDocente,
  actualizarDocente,
};
