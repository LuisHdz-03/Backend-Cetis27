const prisma = require("../../config/prisma");
const bcrypt = require("bcryptjs");
const XLSX = require("xlsx");

// Generador de token alfanumérico único de 10 caracteres
const generarTokenPadre = async (tx) => {
  const caracteres =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token;
  let existe = true;
  while (existe) {
    token = Array.from(
      { length: 10 },
      () => caracteres[Math.floor(Math.random() * caracteres.length)],
    ).join("");
    const encontrado = await tx.estudiante.findUnique({
      where: { tokenPadre: token },
    });
    existe = !!encontrado;
  }
  return token;
};

// logica para limpiar la matricula
const limpiarMatricula = (valor) => {
  const numStr = String(valor);
  if (/[eE]/.test(numStr)) {
    return parseFloat(numStr).toFixed(0);
  }
  return numStr.trim();
};

//funcion para calcular fecha nacimiento desde la curp
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

const crearEstudiante = async (req, res) => {
  try {
    const {
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      curp,
      email,
      matricula,
      semestre,
      grupoId,
      telefono,
      direccion,
    } = req.body;

    const matriculaLimpia = limpiarMatricula(matricula);
    const fechaNac = extraerFechaDesdeCURP(curp);
    const usernameGenerado = matriculaLimpia;
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
          rol: "ALUMNO",
          activo: true,
          passwordChangeRequired: true,
        },
      });

      const fechaEmisionAuto = new Date();
      const fechaExpiracionAuto = new Date();
      fechaExpiracionAuto.setFullYear(fechaEmisionAuto.getFullYear() + 3);

      // Generar tokenPadre único
      const tokenPadre = await generarTokenPadre(tx);

      const nuevoEstudiante = await tx.estudiante.create({
        data: {
          matricula: matriculaLimpia,
          semestre: parseInt(semestre),
          usuarioId: nuevoUsuario.idUsuario,
          grupoId: grupoId ? parseInt(grupoId) : null,
          credencialFechaEmision: fechaEmisionAuto,
          credencialFechaExpiracion: fechaExpiracionAuto,
          tokenPadre,
        },
      });

      return { usuario: nuevoUsuario, estudiante: nuevoEstudiante };
    });
    res.status(201).json({
      mensaje: "estudiante creado exitosamente",
      credenciales: {
        username: resultado.usuario.username,
        password_inicial: passwordInicial,
        tokenPadre: resultado.estudiante.tokenPadre,
        aviso:
          "El usuario debe cambiar la contraseña en el primer inicio de sesión. El tokenPadre es para acceso de padres/tutores.",
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
            username: true,
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
        tutor: true,
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
      const usernameGenerado = matriculaLimpia;
      const passwordInicial = extraerFechaPasswordDesdeCURP(curpExcel);
      const emailExcel = fila["EMAIL"];
      const emailNormalizado = emailExcel
        ? String(emailExcel).trim().toLowerCase()
        : null;

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
        const hashedPassword = await bcrypt.hash(passwordInicial, salt);

        await prisma.$transaction(async (tx) => {
          const estudianteExistente = await tx.estudiante.findUnique({
            where: { matricula: matriculaLimpia },
            include: { usuario: true },
          });

          if (estudianteExistente) {
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
            ) {
              usuarioUpdate.curp = curpExcel.trim().toUpperCase();
              usuarioUpdate.username = usernameGenerado;
            }
            if (emailNormalizado !== estudianteExistente.usuario.email)
              usuarioUpdate.email = emailNormalizado;
            if (
              fechaNac &&
              fechaNac.getTime() !==
                estudianteExistente.usuario.fechaNacimiento?.getTime()
            )
              usuarioUpdate.fechaNacimiento = fechaNac;

            if (Object.keys(usuarioUpdate).length > 0) {
              await tx.usuario.update({
                where: { idUsuario: estudianteExistente.usuarioId },
                data: usuarioUpdate,
              });
            }

            const estudianteUpdate = {};
            const semestreInt = parseInt(semestreExcel) || 1;
            if (semestreInt !== estudianteExistente.semestre)
              estudianteUpdate.semestre = semestreInt;
            if (grupoEncontrado.idGrupo !== estudianteExistente.grupoId)
              estudianteUpdate.grupoId = grupoEncontrado.idGrupo;

            // Mantenemos el tokenPadre que ya tenga si existe, si no, le generamos uno
            if (!estudianteExistente.tokenPadre) {
              estudianteUpdate.tokenPadre = await generarTokenPadre(tx);
            }

            if (Object.keys(estudianteUpdate).length > 0) {
              await tx.estudiante.update({
                where: { idEstudiante: estudianteExistente.idEstudiante },
                data: estudianteUpdate,
              });
            }
          } else {
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
                rol: "ALUMNO",
                activo: true,
                passwordChangeRequired: true,
              },
            });

            // Generar token para inserción masiva
            const tokenPadre = await generarTokenPadre(tx);

            await tx.estudiante.create({
              data: {
                matricula: matriculaLimpia,
                semestre: parseInt(semestreExcel) || 1,
                usuarioId: nuevoUsuario.idUsuario,
                grupoId: grupoEncontrado.idGrupo,
                credencialFechaEmision: fechaEmisionAuto,
                credencialFechaExpiracion: fechaExpiracionAuto,
                tokenPadre,
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
    const {
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      curp,
      matricula,
      credencialFechaEmision,
      credencialFechaExpiracion,
      telefono,
      direccion,
      semestre,
      grupoId,
      tutor,
      email, // <-- Hacemos email opcional
    } = req.body;

    const estudianteExistente = await prisma.estudiante.findUnique({
      where: { idEstudiante: parseInt(id) },
      include: { tutor: true },
    });

    if (!estudianteExistente) {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }

    const estudianteActualizado = await prisma.$transaction(async (tx) => {
      let idTutorAsignado = estudianteExistente.tutorId;

      if (tutor && tutor.nombre) {
        if (estudianteExistente.tutorId) {
          await tx.tutor.update({
            where: { idTutor: estudianteExistente.tutorId },
            data: {
              nombre: tutor.nombre,
              apellidoPaterno: tutor.apellidoPaterno || "",
              apellidoMaterno: tutor.apellidoMaterno || "",
              telefono: tutor.telefono || "",
              email: tutor.email || null,
              parentesco: tutor.parentesco || "Tutor",
              direccion: tutor.direccion || "",
            },
          });
        } else {
          const nuevoTutor = await tx.tutor.create({
            data: {
              nombre: tutor.nombre,
              apellidoPaterno: tutor.apellidoPaterno || "",
              apellidoMaterno: tutor.apellidoMaterno || "",
              telefono: tutor.telefono || "",
              email: tutor.email || null,
              parentesco: tutor.parentesco || "Tutor",
              direccion: tutor.direccion || "",
            },
          });
          idTutorAsignado = nuevoTutor.idTutor;
        }
      }

      const dataEstudiante = {};

      if (matricula !== undefined) dataEstudiante.matricula = matricula;

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
        dataEstudiante.grupoId = grupoId === null ? null : parseInt(grupoId);
      }

      if (idTutorAsignado !== estudianteExistente.tutorId) {
        dataEstudiante.tutorId = idTutorAsignado;
      }

      if (Object.keys(dataEstudiante).length > 0) {
        await tx.estudiante.update({
          where: { idEstudiante: parseInt(id) },
          data: dataEstudiante,
        });
      }

      const dataUsuario = {};

      if (nombre !== undefined) dataUsuario.nombre = nombre;
      if (apellidoPaterno !== undefined)
        dataUsuario.apellidoPaterno = apellidoPaterno;
      if (apellidoMaterno !== undefined)
        dataUsuario.apellidoMaterno = apellidoMaterno;
      if (curp !== undefined) {
        dataUsuario.curp = curp.trim().toUpperCase();
        const matriculaParaUsername =
          matricula !== undefined
            ? limpiarMatricula(matricula)
            : estudianteExistente.matricula;
        dataUsuario.username = matriculaParaUsername;
      }
      if (email !== undefined)
        dataUsuario.email = email ? email.trim().toLowerCase() : null;

      if (telefono !== undefined) dataUsuario.telefono = telefono;
      if (direccion !== undefined) dataUsuario.direccion = direccion;

      if (Object.keys(dataUsuario).length > 0) {
        await tx.usuario.update({
          where: { idUsuario: estudianteExistente.usuarioId },
          data: dataUsuario,
        });
      }

      return await tx.estudiante.findUnique({
        where: { idEstudiante: parseInt(id) },
        include: {
          usuario: {
            select: {
              nombre: true,
              apellidoPaterno: true,
              apellidoMaterno: true,
              username: true,
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
          tutor: {
            select: {
              nombre: true,
              apellidoPaterno: true,
              apellidoMaterno: true,
              telefono: true,
              email: true,
              parentesco: true,
              direccion: true,
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

const descargarPlantillaEstudiantes = async (req, res) => {
  try {
    const filasEjemplo = [
      {
        CARRERA: "PROGRAMACION",
        TURNO: "MATUTINO",
        SEMESTRE: 4,
        GRUPO: "4A",
        "NO CONTROL": "22603061070031",
        NOMBRE: "JUAN",
        PATERNO: "PEREZ",
        MATERNO: "LOPEZ",
        CURP: "PELJ080101HDFRPN01",
        EMAIL: "alumno@correo.com",
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(filasEjemplo);
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Estudiantes");

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="plantilla_estudiantes.xlsx"',
    );

    return res.send(buffer);
  } catch (error) {
    console.error("Error al generar plantilla de estudiantes:", error);
    return res
      .status(500)
      .json({ error: "Error al generar plantilla de estudiantes" });
  }
};

const getDatosCredenciales = async (req, res) => {
  try {
    const { grupoId } = req.query;

    const where = grupoId ? { grupoId: parseInt(grupoId) } : {};

    const estudiantes = await prisma.estudiante.findMany({
      where,
      include: {
        usuario: {
          select: {
            nombre: true,
            apellidoPaterno: true,
            apellidoMaterno: true,
            curp: true,
            email: true,
            activo: true,
          },
        },
        grupo: {
          select: {
            nombre: true,
            turno: true,
            especialidad: { select: { nombre: true } },
          },
        },
      },
    });

    // Filtrar solo usuarios activos
    const resultado = estudiantes
      .filter((e) => e.usuario && e.usuario.activo)
      .map((e) => ({
        nombre: e.usuario.nombre,
        apellidoPaterno: e.usuario.apellidoPaterno,
        apellidoMaterno: e.usuario.apellidoMaterno,
        curp: e.usuario.curp,
        noControl: e.matricula,
        fotoUrl: e.fotoUrl || null,
        grupo: e.grupo?.nombre || null,
        especialidad: e.grupo?.especialidad?.nombre || null,
        turno: e.grupo?.turno || null,
        emision: e.credencialFechaEmision || null,
        vigencia: e.credencialFechaExpiracion || null,
      }));

    res.json(resultado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener datos de credenciales" });
  }
};

module.exports = {
  crearEstudiante,
  getEstudiantes,
  cargarDatosMasivos,
  actualizarEstudiante,
  eliminarEstudiante,
  getEstudiantesPorGrupo,
  descargarPlantillaEstudiantes,
  getDatosCredenciales,
};
