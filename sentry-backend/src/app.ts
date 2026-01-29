import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { sseManager } from './services/sse/SSEManager';
import { contextMiddleware } from './api/middlewares/context';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(contextMiddleware);

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SSE Endpoint
app.get('/events', (req, res) => {
    const tenantId = req.user?.tenantId;
    sseManager.addClient(res, tenantId);
});

// API Routes
import apiRoutes from './api/routes';
app.use('/api', apiRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
});

export default app;
