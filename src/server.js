require("dotenv").config();
const app = require("./app");
const prisma = require("./config/prisma");
const env = require("./config/env");

let server;
let isShuttingDown = false;
let dbKeepAliveInterval;

const gracefulShutdown = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  clearInterval(dbKeepAliveInterval);

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
    server.timeout = 30000;
    server.keepAliveTimeout = 65000;

    dbKeepAliveInterval = setInterval(async () => {
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch {
      }
    }, 4 * 60 * 1000);
    dbKeepAliveInterval.unref();

    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINT", gracefulShutdown);
  } catch (error) {
    await prisma.$disconnect();
    process.exit(1);
  }
}
main();
