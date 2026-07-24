import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const defaultClientUrl = nodeEnv === 'production'
  ? 'https://feppm.netlify.app'
  : 'http://localhost:5173';

function commaSeparatedValues(value) {
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
}

export const env = Object.freeze({
  nodeEnv,
  port: Number(process.env.PORT ?? 5000),
  clientUrls: commaSeparatedValues(process.env.CLIENT_URLS ?? process.env.CLIENT_URL ?? defaultClientUrl),
  jwtSecret: required('JWT_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  jwtIssuer: process.env.JWT_ISSUER ?? 'feppm-api',
  jwtAudience: process.env.JWT_AUDIENCE ?? 'feppm-web',
  evidenceVerificationSecret: process.env.EVIDENCE_VERIFICATION_SECRET ?? required('JWT_SECRET'),
  evidenceGeofenceRadiusMeters: Number(process.env.EVIDENCE_GEOFENCE_RADIUS_METERS ?? 250),
  evidenceMaxGpsAccuracyMeters: Number(process.env.EVIDENCE_MAX_GPS_ACCURACY_METERS ?? 100),
  evidenceGeofenceEnforced: String(process.env.EVIDENCE_GEOFENCE_ENFORCED ?? 'false').toLowerCase() === 'true',
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
  cloudinaryUploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET ?? '',
  cloudinaryUploadFolder: process.env.CLOUDINARY_UPLOAD_FOLDER ?? 'feppm/photos',
  refreshCookieName: process.env.REFRESH_COOKIE_NAME ?? 'feppm_refresh_token',
  refreshCookieMaxAgeMs: Number(process.env.REFRESH_COOKIE_MAX_AGE_MS ?? 604800000),
});
