const { PrismaClient } = require("@prisma/client");

// Más tiempo para conectar y esperar conexión del pool (útil con BD en frío)
const withTimeouts = (url) => {
  if (!url) return url;
  const separator = url.includes("?") ? "&" : "?";
  const extras = [];
  if (!/[?&]connect_timeout=/.test(url)) extras.push("connect_timeout=30");
  if (!/[?&]pool_timeout=/.test(url)) extras.push("pool_timeout=30");
  return extras.length ? `${url}${separator}${extras.join("&")}` : url;
};

const prisma = new PrismaClient({
  datasourceUrl: withTimeouts(process.env.DATABASE_URL),
});

module.exports = prisma;
