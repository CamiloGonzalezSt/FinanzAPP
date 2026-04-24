import dotenv from "dotenv";

dotenv.config();

/**
 * Soporta un solo ID o varios separados por coma (p. ej. Web + iOS + Android) para
 * verificar el idToken de Google con distintos "aud" según plataforma.
 */
function parseGoogleClientIds(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const googleClientIdRaw = process.env.GOOGLE_CLIENT_ID ?? "";

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  databaseUrl: process.env.DATABASE_URL ?? "",
  /** Primer client ID (compatibilidad) */
  googleClientId: parseGoogleClientIds(googleClientIdRaw)[0] ?? "",
  /** Todos los client IDs que emiten idTokens validos (Web, iOS, Android) */
  googleOAuthClientIds: parseGoogleClientIds(googleClientIdRaw),
  /** URL pública de la API (para links de reseteo en emails) */
  publicUrl: process.env.PUBLIC_URL ?? "http://localhost:4000",
  /** SMTP — si no está configurado, los links se imprimen solo en la consola */
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  smtpFrom: process.env.SMTP_FROM ?? "",
};
