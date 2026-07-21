import bcrypt from 'bcryptjs';

import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import {
  createAccessToken,
  createRefreshToken,
  refreshCookieOptions,
  verifyRefreshToken,
} from '../services/authService.js';
import {
  findUserCredentialsByEmail,
  findUserForAuthentication,
  serializeAuthenticatedUser,
  userHasRole,
} from '../services/userAccessService.js';

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function setRefreshCookie(response, token, persistent) {
  response.cookie(env.refreshCookieName, token, refreshCookieOptions(persistent));
}

function issueSession(response, user, persistent = true) {
  const accessToken = createAccessToken(user.id);
  const refreshToken = createRefreshToken(user.id, persistent);
  setRefreshCookie(response, refreshToken, persistent);

  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: env.jwtAccessExpiresIn,
    user: serializeAuthenticatedUser(user),
  };
}

export async function login(request, response) {
  const email = normalizeEmail(request.body?.email);
  const password = typeof request.body?.password === 'string' ? request.body.password : '';
  const rememberMe = request.body?.rememberMe === true;

  if (!email || !password) {
    return response.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  const user = await findUserCredentialsByEmail(email);
  const passwordIsValid = user ? await bcrypt.compare(password, user.passwordHash) : false;

  if (!user || !passwordIsValid) {
    return response.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  if (user.status !== 'ACTIVE') {
    return response.status(403).json({ success: false, message: 'This account is not active.' });
  }

  if (!userHasRole(user, 'SUPER_ADMIN')) {
    return response.status(403).json({ success: false, message: 'Super Admin access is required.' });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return response.json({ success: true, message: 'Login successful.', data: issueSession(response, user, rememberMe) });
}

export async function refreshSession(request, response) {
  const refreshToken = request.cookies?.[env.refreshCookieName];

  if (!refreshToken) {
    return response.status(401).json({ success: false, message: 'Refresh token required.' });
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    const user = await findUserForAuthentication(payload.sub);

    if (!user || user.status !== 'ACTIVE' || !userHasRole(user, 'SUPER_ADMIN')) {
      return response.status(401).json({ success: false, message: 'Unable to refresh this session.' });
    }

    return response.json({ success: true, data: issueSession(response, user, payload.persistent === true) });
  } catch {
    response.clearCookie(env.refreshCookieName, refreshCookieOptions(false));
    return response.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
  }
}

export function logout(_request, response) {
  response.clearCookie(env.refreshCookieName, refreshCookieOptions(false));
  return response.json({ success: true, message: 'Logout successful.' });
}

export function getCurrentUser(request, response) {
  return response.json({ success: true, data: { user: request.auth } });
}
