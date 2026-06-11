export const success = (res, data, statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId,
    },
  });
};

export const paginated = (res, data, pagination, statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    data,
    pagination,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId,
    },
  });
};

export const error = (res, err) => {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  
  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message,
      code,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId,
    },
  });
};
