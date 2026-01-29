"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const SSEManager_1 = require("./services/sse/SSEManager");
const context_1 = require("./api/middlewares/context");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Middlewares
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(context_1.contextMiddleware);
// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// SSE Endpoint
app.get('/events', (req, res) => {
    const tenantId = req.user?.tenantId;
    SSEManager_1.sseManager.addClient(res, tenantId);
});
// API Routes
const routes_1 = __importDefault(require("./api/routes"));
app.use('/api', routes_1.default);
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
});
exports.default = app;
