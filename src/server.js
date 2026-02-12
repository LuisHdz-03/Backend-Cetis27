require("dotenv").config();
const app = require("./app");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;

async function main() {
  try {
    await prisma.$connect();
    app.listen(PORT, () => {
      console.log(`\n Servidor Cetis27 corriendo en: http://localhost:${PORT}`);
      console.log(` API Web:   http://localhost:${PORT}/api/web`);
      console.log(` API Móvil: http://localhost:${PORT}/api/movil`);
    });
  } catch (error) {
    console.error("error al inicializar el servidor: ", error);
    process.exit(1);
  }
}
main();
