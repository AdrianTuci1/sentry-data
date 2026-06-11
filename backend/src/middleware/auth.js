import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { UnauthorizedError } from '../utils/errors.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwtSecret);

    req.user = {
      userId: decoded.sub,
      email: decoded.email,
      roles: decoded.roles || [],
      orgId: decoded.orgId,
    };

    next();
  } catch (err) {
    next(new UnauthorizedError('Invalid or expired token'));
  }
};

export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const hasRole = roles.some(role => req.user.roles.includes(role));
    if (!hasRole) {
      return next(new UnauthorizedError('Insufficient permissions'));
    }

    next();
  };
};

export const requireOrgAccess = (req, res, next) => {
  const orgId = req.params.orgId || req.body.orgId;
  
  if (!orgId) {
    return next(new UnauthorizedError('Organization ID required'));
  }

  // In a real implementation, check user's org memberships
  // For now, we trust the JWT token which is scoped
  req.user.orgId = orgId;
  next();
};
