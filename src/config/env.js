import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5000),
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  jwtSecret: required('JWT_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  jwtIssuer: process.env.JWT_ISSUER ?? 'feppm-api',
  jwtAudience: process.env.JWT_AUDIENCE ?? 'feppm-web',
  refreshCookieName: process.env.REFRESH_COOKIE_NAME ?? 'feppm_refresh_token',
  refreshCookieMaxAgeMs: Number(process.env.REFRESH_COOKIE_MAX_AGE_MS ?? 604800000),
});
