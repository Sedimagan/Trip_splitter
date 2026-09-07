const WEAK_SECRETS = new Set([
  "dev-secret-change-me-in-production",
  "change-me-in-production",
  "secret",
  "changeme",
]);

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || "",
  databaseUrl: process.env.DATABASE_URL || "",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  s3: {
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION || "auto",
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    endpoint: process.env.S3_ENDPOINT,
    publicUrlBase: process.env.S3_PUBLIC_URL_BASE,
  },
};

/** Fails fast on startup rather than serving traffic with an insecure or
 * missing configuration -- a misconfigured production deploy should crash
 * immediately, not silently accept forged tokens. */
export function assertValidEnv() {
  const problems: string[] = [];

  if (!env.jwtSecret) problems.push("JWT_SECRET is not set");
  else if (env.jwtSecret.length < 32) problems.push("JWT_SECRET must be at least 32 characters");
  else if (WEAK_SECRETS.has(env.jwtSecret)) problems.push("JWT_SECRET is still set to a placeholder value");

  if (!env.databaseUrl) problems.push("DATABASE_URL is not set");

  if (env.isProduction && env.corsOrigin === "*") {
    problems.push("CORS_ORIGIN must be set to your app's real origin(s) in production, not '*'");
  }

  if (env.isProduction && problems.length > 0) {
    // eslint-disable-next-line no-console
    console.error("Refusing to start: invalid production configuration:\n- " + problems.join("\n- "));
    process.exit(1);
  } else if (problems.length > 0) {
    // eslint-disable-next-line no-console
    console.warn("Configuration warnings (fine for local dev, must be fixed before production):\n- " + problems.join("\n- "));
  }
}

export function corsOriginList(): string[] | "*" {
  if (env.corsOrigin === "*") return "*";
  return env.corsOrigin.split(",").map((o) => o.trim()).filter(Boolean);
}
