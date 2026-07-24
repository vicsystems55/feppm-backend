import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';

const verificationOptions = {
  algorithms: ['HS256'],
  issuer: env.jwtIssuer,
  audience: 'feppm-evidence',
};

export function createEvidenceToken(metadata) {
  return jwt.sign(
    { tokenType: 'evidence-verification', ...metadata },
    env.evidenceVerificationSecret,
    {
      algorithm: 'HS256',
      issuer: env.jwtIssuer,
      audience: 'feppm-evidence',
      expiresIn: '7d',
    },
  );
}

export function verifyEvidenceToken(token) {
  const payload = jwt.verify(
    String(token ?? ''),
    env.evidenceVerificationSecret,
    verificationOptions,
  );
  if (
    typeof payload !== 'object'
    || payload.tokenType !== 'evidence-verification'
  ) {
    throw new jwt.JsonWebTokenError('Invalid evidence verification token.');
  }
  return payload;
}

export function distanceMeters(latitudeA, longitudeA, latitudeB, longitudeB) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = radians(latitudeB - latitudeA);
  const longitudeDelta = radians(longitudeB - longitudeA);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(latitudeA))
    * Math.cos(radians(latitudeB))
    * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
