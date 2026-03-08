"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = void 0;
const requestLogger = (req, res, next) => {
    const start = Date.now();
    // We hook into the finish event of the response to log the total time taken
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logLine = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} [${duration}ms] {IP: ${req.ip}}`;
        console.log(logLine);
    });
    next();
};
exports.requestLogger = requestLogger;
