const DEFAULT_PORT = 4000;

const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
};

const parseTrustProxy = (value) => {
  if (value === undefined || value === null || value === "") {
    return 1;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["true", "yes", "on"].includes(normalized)) return true;
  if (["false", "no", "off"].includes(normalized)) return false;

  const asNumber = Number(value);
  if (!Number.isNaN(asNumber)) {
    return asNumber;
  }

  return value;
};

const parseOrigins = (value) =>
  String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";

const port = Number(process.env.PORT || DEFAULT_PORT);
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error("Invalid PORT value");
}

const jwtSecret = requireEnv("JWT_SECRET");
const allowWeakJwtSecret = parseBoolean(
  process.env.ALLOW_WEAK_JWT_SECRET,
  false,
);

if (isProduction && !allowWeakJwtSecret && jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters in production");
}

const databaseUrl = requireEnv("DATABASE_URL");
const corsOrigins = parseOrigins(process.env.CORS_ORIGINS);

if (isProduction && corsOrigins.length === 0) {
  throw new Error("CORS_ORIGINS must be configured in production");
}

module.exports = {
  nodeEnv,
  isProduction,
  port,
  jwtSecret,
  databaseUrl,
  corsOrigins,
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  jsonBodyLimit: process.env.JSON_BODY_LIMIT || "1mb",
  httpLogsEnabled: parseBoolean(process.env.HTTP_LOGS_ENABLED, !isProduction),
  allowWeakJwtSecret,
};
