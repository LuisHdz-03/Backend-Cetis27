require("dotenv").config();
const app = require("./app");
const prisma = require("./config/prisma");
const env = require("./config/env");

let server;
let isShuttingDown = false;

const gracefulShutdown = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
};

process.on("unhandledRejection", async () => {
  await gracefulShutdown();
});

process.on("uncaughtException", async () => {
  await gracefulShutdown();
});

async function main() {
  try {
    await prisma.$connect();
    server = app.listen(env.port, () => {});

    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINT", gracefulShutdown);
  } catch (error) {
    await prisma.$disconnect();
    process.exit(1);
  }
}
main();
