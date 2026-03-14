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

const crearEstudiante = async (req, res) => {
  try {
    const {
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      curp,
      matricula,
      semestre,
      grupoId,
      telefono,
      direccion,
    } = req.body;

    const matriculaLimpia = limpiarMatricula(matricula);
    const fechaNac = extraerFechaDesdeCURP(curp);
    const emailGenerado = `${curp.substring(0, 10).toLowerCase()}@cetis27.edu.mx`;

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(matricula, salt);

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
          telefono,
          direccion,
          rol: "ALUMNO",
          activo: true,
        },
      });

      const fechaEmisionAuto = new Date();
      const fechaExpiracionAuto = new Date();
      fechaExpiracionAuto.setFullYear(fechaEmisionAuto.getFullYear() + 3);

      const nuevoEstudiante = await tx.estudiante.create({
        data: {
          matricula: matriculaLimpia,
          semestre: parseInt(semestre),
          usuarioId: nuevoUsuario.idUsuario,
          grupoId: grupoId ? parseInt(grupoId) : null,
          credencialFechaEmision: fechaEmisionAuto,
          credencialFechaExpiracion: fechaExpiracionAuto,
        },
      });

      return { usuario: nuevoUsuario, estudiante: nuevoEstudiante };
    });
    res.status(201).json({
      mensaje: "estudiante creado exitosamente",
      credenciales: {
        email: resultado.usuario.email,
        password_inicial: matricula,
      },
    });
  } catch (error) {
    console.error(error);
    if (error.code === "P2002") {
      return res.status(400).json({ error: "El alumno ya existe " });
    }
    console.error(error);
    res.status(500).json({ error: "error en el servidor" });
  }
};

const getEstudiantes = async (req, res) => {
  try {
    const estudiantes = await prisma.estudiante.findMany({
      include: {
        usuario: {
          select: {
            nombre: true,
            apellidoPaterno: true,
            apellidoMaterno: true,
            email: true,
            activo: true,
            fechaNacimiento: true,
            curp: true,
            direccion: true,
            telefono: true,
          },
        },
        grupo: {
          select: {
            nombre: true,
            grado: true,
            turno: true,
            especialidad: true,
          },
        },
      },
    });

    res.json(estudiantes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Error al obtener los alumnos" });
  }
};

const cargarDatosMasivos = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, msg: "No se subió archivo" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const datosExcel = XLSX.utils.sheet_to_json(sheet);

    const errores = [];
    const datosInsertados = [];

    const fechaEmisionAuto = new Date();
    const fechaExpiracionAuto = new Date();
    fechaExpiracionAuto.setFullYear(fechaEmisionAuto.getFullYear() + 3);

    for (const fila of datosExcel) {
      const carreraExcel = fila["CARRERA"];
      const turnoExcel = fila["TURNO"];
      const semestreExcel = fila["SEMESTRE"];
      const grupoNombreExcel = fila["GRUPO"];
      const matriculaExcel = fila["NO CONTROL"];
      const nombreExcel = fila["NOMBRE"];
      const paternoExcel = fila["PATERNO"];
      const maternoExcel = fila["MATERNO"];
      const curpExcel = fila["CURP"];

      if (!matriculaExcel || !curpExcel || !nombreExcel) {
        errores.push({
          matricula: "Desc",
          error: "Fila vacía o sin datos clave",
        });
        continue;
      }

      const matriculaLimpia = limpiarMatricula(matriculaExcel);
      const fechaNac = extraerFechaDesdeCURP(curpExcel);
      const emailGenerado = `${curpExcel.substring(0, 10).toLowerCase()}@cetis27.edu.mx`;

      const turnoQuery = fila["TURNO"]
        ? fila["TURNO"].toUpperCase()
        : "MATUTINO";
      try {
        const grupoEncontrado = await prisma.grupo.findFirst({
          where: {
            nombre: fila["GRUPO"].toString(),
            grado: parseInt(fila["SEMESTRE"]),
            turno: turnoQuery,
            especialidad: {
              nombre: fila["CARRERA"],
            },
            periodo: {
              activo: true,
            },
          },
        });

        if (!grupoEncontrado) {
          errores.push({
            matricula: matriculaExcel,
            error: `No se encontró el grupo ${grupoNombreExcel} de ${carreraExcel} en la BD`,
          });
          continue;
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(matriculaLimpia, salt);

        await prisma.$transaction(async (tx) => {
          // Buscar si ya existe un estudiante con esa matrícula
          const estudianteExistente = await tx.estudiante.findUnique({
            where: { matricula: matriculaLimpia },
            include: { usuario: true },
          });

          if (estudianteExistente) {
            // Si existe, actualizar solo los campos que sean diferentes
            const usuarioUpdate = {};
            if (nombreExcel !== estudianteExistente.usuario.nombre)
              usuarioUpdate.nombre = nombreExcel;
            if (
              (paternoExcel || "") !==
              estudianteExistente.usuario.apellidoPaterno
            )
              usuarioUpdate.apellidoPaterno = paternoExcel || "";
            if (
              (maternoExcel || "") !==
              estudianteExistente.usuario.apellidoMaterno
            )
              usuarioUpdate.apellidoMaterno = maternoExcel || "";
            if (
              curpExcel.trim().toUpperCase() !==
              estudianteExistente.usuario.curp
            )
              usuarioUpdate.curp = curpExcel.trim().toUpperCase();
            if (emailGenerado !== estudianteExistente.usuario.email)
              usuarioUpdate.email = emailGenerado;
            if (
              fechaNac &&
              fechaNac.getTime() !==
                estudianteExistente.usuario.fechaNacimiento?.getTime()
            )
              usuarioUpdate.fechaNacimiento = fechaNac;

            // Actualizar usuario si hay cambios
            if (Object.keys(usuarioUpdate).length > 0) {
              await tx.usuario.update({
                where: { idUsuario: estudianteExistente.usuarioId },
                data: usuarioUpdate,
              });
            }

            // Actualizar estudiante si hay cambios
            const estudianteUpdate = {};
            const semestreInt = parseInt(semestreExcel) || 1;
            if (semestreInt !== estudianteExistente.semestre)
              estudianteUpdate.semestre = semestreInt;
            if (grupoEncontrado.idGrupo !== estudianteExistente.grupoId)
              estudianteUpdate.grupoId = grupoEncontrado.idGrupo;

            if (Object.keys(estudianteUpdate).length > 0) {
              await tx.estudiante.update({
                where: { idEstudiante: estudianteExistente.idEstudiante },
                data: estudianteUpdate,
              });
            }
          } else {
            // Si no existe, crear nuevo
            const nuevoUsuario = await tx.usuario.create({
              data: {
                nombre: nombreExcel,
                apellidoPaterno: paternoExcel || "",
                apellidoMaterno: maternoExcel || "",
                email: emailGenerado,
                curp: curpExcel.trim().toUpperCase(),
                fechaNacimiento: fechaNac,
                password: hashedPassword,
                rol: "ALUMNO",
                activo: true,
              },
            });

            await tx.estudiante.create({
              data: {
                matricula: matriculaLimpia,
                semestre: parseInt(semestreExcel) || 1,
                usuarioId: nuevoUsuario.idUsuario,
                grupoId: grupoEncontrado.idGrupo,
                credencialFechaEmision: fechaEmisionAuto,
                credencialFechaExpiracion: fechaExpiracionAuto,
              },
            });
          }
        });

        datosInsertados.push(matriculaExcel);
      } catch (error) {
        console.error(`Error con ${matriculaExcel}:`, error);
        let msg = "Error desconocido";
        if (error.code === "P2002") msg = "Alumno/Usuario duplicado";

        errores.push({ matricula: matriculaExcel, error: msg });
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

const actualizarEstudiante = async (req, res) => {
  try {
    const { id } = req.params;
    // 1. Extraemos TODOS los campos que queremos actualizar, incluyendo semestre y grupoId
    const {
      credencialFechaEmision,
      credencialFechaExpiracion,
      telefono,
      direccion,
      semestre,
      grupoId,
    } = req.body;

    // 2. Buscamos al estudiante primero para saber cuál es su 'usuarioId'
    const estudianteExistente = await prisma.estudiante.findUnique({
      where: { idEstudiante: parseInt(id) },
    });

    if (!estudianteExistente) {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }

    // 3. Usamos una transacción para actualizar ambas tablas (Estudiante y Usuario) de forma segura
    const estudianteActualizado = await prisma.$transaction(async (tx) => {
      // -- A) Actualizar tabla Estudiante --
      const dataEstudiante = {};

      if (credencialFechaEmision) {
        dataEstudiante.credencialFechaEmision = new Date(
          credencialFechaEmision,
        );
      }
      if (credencialFechaExpiracion) {
        dataEstudiante.credencialFechaExpiracion = new Date(
          credencialFechaExpiracion,
        );
      }
      if (semestre !== undefined) {
        dataEstudiante.semestre = parseInt(semestre);
      }
      if (grupoId !== undefined) {
        // Si grupoId es null (ej. dar de baja de un grupo), lo permitimos, sino lo parseamos
        dataEstudiante.grupoId = grupoId === null ? null : parseInt(grupoId);
      }

      if (Object.keys(dataEstudiante).length > 0) {
        await tx.estudiante.update({
          where: { idEstudiante: parseInt(id) },
          data: dataEstudiante,
        });
      }

      // -- B) Actualizar tabla Usuario (teléfono y dirección) --
      const dataUsuario = {};
      if (telefono !== undefined) dataUsuario.telefono = telefono;
      if (direccion !== undefined) dataUsuario.direccion = direccion;

      if (Object.keys(dataUsuario).length > 0) {
        await tx.usuario.update({
          where: { idUsuario: estudianteExistente.usuarioId },
          data: dataUsuario,
        });
      }

      // -- C) Retornar el estudiante con sus relaciones actualizadas INCLUIDAS --
      return await tx.estudiante.findUnique({
        where: { idEstudiante: parseInt(id) },
        include: {
          usuario: {
            select: {
              nombre: true,
              apellidoPaterno: true,
              apellidoMaterno: true,
              email: true,
              activo: true,
              fechaNacimiento: true,
              curp: true,
              telefono: true,
              direccion: true,
            },
          },
          grupo: {
            select: {
              nombre: true,
              grado: true,
              turno: true,
              especialidad: true,
            },
          },
        },
      });
    });

    res.json({
      mensaje: "Estudiante actualizado correctamente",
      estudiante: estudianteActualizado,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar el estudiante" });
  }
};

const eliminarEstudiante = async (req, res) => {
  try {
    const { id } = req.params;

    const estudiante = await prisma.estudiante.findUnique({
      where: { idEstudiante: parseInt(id) },
    });

    if (!estudiante) {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }

    await prisma.usuario.update({
      where: { idUsuario: estudiante.usuarioId },
      data: { activo: false },
    });

    res.json({ mensaje: "Estudiante dado de baja correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al dar de baja al estudiante" });
  }
};

const getEstudiantesPorGrupo = async (req, res) => {
  const { grupoId } = req.params;

  try {
    const alumnos = await prisma.estudiante.findMany({
      where: { grupoId: parseInt(grupoId) },
      include: {
        usuario: {
          select: {
            nombre: true,
            apellidoPaterno: true,
            apellidoMaterno: true,
          },
        },
      },
      // Opcional: Ordenarlos alfabéticamente por apellido
      orderBy: {
        usuario: {
          apellidoPaterno: "asc",
        },
      },
    });

    res.json(alumnos);
  } catch (error) {
    console.error("Error al obtener alumnos por grupo:", error);
    res.status(500).json({ error: "Error al obtener la lista de estudiantes" });
  }
};

module.exports = {
  crearEstudiante,
  getEstudiantes,
  cargarDatosMasivos,
  actualizarEstudiante,
  eliminarEstudiante,
  getEstudiantesPorGrupo,
};
