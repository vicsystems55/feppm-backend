import { findUserForAuthentication, serializeAuthenticatedUser, userHasRole } from '../services/userAccessService.js';
import { verifyAccessToken } from '../services/authService.js';

export async function authenticate(request, response, next) {
  const authorization = request.get('authorization');
  const [scheme, token] = authorization?.split(' ') ?? [];

  if (scheme !== 'Bearer' || !token) {
    return response.status(401).json({ success: false, message: 'Authentication required.' });
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await findUserForAuthentication(payload.sub);

    if (!user || user.status !== 'ACTIVE') {
      return response.status(401).json({ success: false, message: 'Authentication required.' });
    }

    request.authUser = user;
    request.auth = serializeAuthenticatedUser(user);
    return next();
  } catch {
    return response.status(401).json({ success: false, message: 'Invalid or expired access token.' });
  }
}

export function requireRole(roleKey) {
  return function authorizeRole(request, response, next) {
    if (!request.authUser || !userHasRole(request.authUser, roleKey)) {
      return response.status(403).json({ success: false, message: 'You do not have permission to access this resource.' });
    }

    return next();
  };
}

export function requirePermission(permissionKey) {
  return function authorizePermission(request, response, next) {
    if (!request.auth?.permissions?.includes(permissionKey)) {
      return response.status(403).json({ success: false, message: 'You do not have permission to access this resource.' });
    }
    return next();
  };
}
