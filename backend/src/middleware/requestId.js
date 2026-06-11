import { randomUUID } from 'crypto';

export const requestId = (req, res, next) => {
  res.locals.requestId = req.headers['x-request-id'] || randomUUID();
  res.setHeader('x-request-id', res.locals.requestId);
  next();
};
