require("dotenv").config();
const app = require("./app");
const prisma = require("./config/prisma");
const PORT = process.env.PORT || 4000;

process.on("unhandledRejection", (reason) => {
  console.error("Promesa no manejada:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Excepción no capturada:", error);
  process.exit(1);
});

async function main() {
  try {
    await prisma.$connect();
    const server = app.listen(PORT, () => {
      console.log(`\n Servidor Cetis27 corriendo en: http://localhost:${PORT}`);
      console.log(` API Web:   http://localhost:${PORT}/api/web`);
      console.log(` API Móvil: http://localhost:${PORT}/api/movil`);
    });

    process.on("SIGTERM", async () => {
      console.log("SIGTERM recibido, cerrando servidor...");
      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
    });
  } catch (error) {
    console.error("error al inicializar el servidor: ", error);
    process.exit(1);
  }
}
main();
