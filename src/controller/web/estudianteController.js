const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const XLSX = require("xlsx");
const prisma = new PrismaClient();

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
    } = req.body;

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
          password: hashedPassword,
          rol: "ALUMNO",
          activo: true,
        },
      });

      const fechaEmisionAuto = new Date();
      const fechaExpiracionAuto = new Date();
      fechaExpiracionAuto.setFullYear(fechaEmisionAuto.getFullYear() + 3);

      const nuevoEstudiante = await tx.estudiante.create({
        data: {
          matricula,
          curp,
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
          },
        },
        grupo: {
          select: {
            nombre: true,
            grado: true,
            turno: true,
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

      try {
        const turnoQuery = fila["TURNO"]
          ? fila["TURNO"].toUpperCase()
          : "MATUTINO";

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

        const emailGenerado = `${curpExcel.substring(0, 10).toLowerCase()}@cetis27.edu.mx`;
        const matriculaString = String(matriculaExcel);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(matriculaString, salt);

        await prisma.$transaction(async (tx) => {
          const nuevoUsuario = await tx.usuario.create({
            data: {
              nombre: nombreExcel,
              apellidoPaterno: paternoExcel || "",
              apellidoMaterno: maternoExcel || "",
              email: emailGenerado,
              password: hashedPassword,
              rol: "ALUMNO",
              activo: true,
            },
          });

          await tx.estudiante.create({
            data: {
              matricula: matriculaString,
              curp: curpExcel,
              semestre: parseInt(semestreExcel) || 1,
              usuarioId: nuevoUsuario.idUsuario,

              grupoId: grupoEncontrado.idGrupo,

              credencialFechaEmision: fechaEmisionAuto,
              credencialFechaExpiracion: fechaExpiracionAuto,
            },
          });
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
    const { credencialFechaEmision, credencialFechaExpiracion } = req.body;

    const dataActualizar = {};
    if (credencialFechaEmision)
      dataActualizar.credencialFechaEmision = new Date(credencialFechaEmision);
    if (credencialFechaExpiracion)
      dataActualizar.credencialFechaExpiracion = new Date(
        credencialFechaExpiracion,
      );

    const estudianteActualizado = await prisma.estudiante.update({
      where: { idEstudiante: parseInt(id) },
      data: dataActualizar,
    });

    res.json({
      mensaje: "Fechas de credencial actualizadas correctamente",
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

    await prisma.estudiante.update({
      where: { idUsuario: estudiante.idEstudiante },
      data: { activo: false },
    });

    res.json({ mensaje: "Estudiante dado de baja correctamente  " });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro al dar de baja al estudiante" });
  }
};

module.exports = {
  crearEstudiante,
  getEstudiantes,
  cargarDatosMasivos,
  actualizarEstudiante,
  eliminarEstudiante,
};
