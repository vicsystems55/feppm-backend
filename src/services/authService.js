import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';

const jwtVerificationOptions = {
  algorithms: ['HS256'],
  issuer: env.jwtIssuer,
  audience: env.jwtAudience,
};

function signToken(userId, tokenType, secret, expiresIn, additionalClaims = {}) {
  return jwt.sign(
    { tokenType, ...additionalClaims },
    secret,
    {
      algorithm: 'HS256',
      subject: userId,
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
      expiresIn,
    },
  );
}

export function createAccessToken(userId) {
  return signToken(userId, 'access', env.jwtSecret, env.jwtAccessExpiresIn);
}

export function createRefreshToken(userId, persistent = true) {
  return signToken(userId, 'refresh', env.jwtRefreshSecret, env.jwtRefreshExpiresIn, { persistent });
}

function verifyToken(token, secret, expectedType) {
  const payload = jwt.verify(token, secret, jwtVerificationOptions);

  if (typeof payload !== 'object' || payload.tokenType !== expectedType || !payload.sub) {
    throw new jwt.JsonWebTokenError('Invalid token payload');
  }

  return payload;
}

export function verifyAccessToken(token) {
  return verifyToken(token, env.jwtSecret, 'access');
}

export function verifyRefreshToken(token) {
  return verifyToken(token, env.jwtRefreshSecret, 'refresh');
}

export function refreshCookieOptions(persistent = true) {
  const options = {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: env.nodeEnv === 'production' ? 'none' : 'lax',
    path: '/api/v1/auth',
  };

  if (persistent) options.maxAge = env.refreshCookieMaxAgeMs;
  return options;
}
