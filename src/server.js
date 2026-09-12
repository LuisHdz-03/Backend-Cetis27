require("dotenv").config();
const cron = require("node-cron");
const app = require("./app");
const prisma = require("./config/prisma");
const env = require("./config/env");

let server;
let isShuttingDown = false;
let dbKeepAliveInterval;
let dailyKeepAliveJob;

const gracefulShutdown = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  clearInterval(dbKeepAliveInterval);
  if (dailyKeepAliveJob) {
    dailyKeepAliveJob.stop();
  }

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

    dbKeepAliveInterval = setInterval(
      async () => {
        try {
          await prisma.$queryRaw`SELECT 1`;
        } catch {}
      },
      4 * 60 * 1000,
    );
    dbKeepAliveInterval.unref();

    dailyKeepAliveJob = cron.schedule(
      "0 3 * * *",
      async () => {
        try {
          await prisma.$queryRaw`SELECT 1`;
        } catch {}
      },
      {
        scheduled: true,
        timezone: "America/Mexico_City",
      },
    );

    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINT", gracefulShutdown);
  } catch (error) {
    await prisma.$disconnect();
    process.exit(1);
  }
}
main();
