import { Router, Request, Response } from 'express';
import { s3 } from '../../dal/s3';
import { requireAuth } from '../middlewares/context';

const router = Router();

// Layer 1: Ingestion & Infrastructure (The "Pipes")
// GET /api/layers/health/connectors
// Returns mock status for Airbyte/Connectors and S3
router.get('/health/connectors', requireAuth, async (req: Request, res: Response) => {
    // Mock Airbyte Status
    const airbyteStatus = {
        name: 'Airbyte Sync',
        status: 'HEALTHY',
        lastSync: new Date().toISOString(),
        details: 'All connections active'
    };

    // Check S3 health by listing top level
    let s3Status = { name: 'S3 Data Lake', status: 'UNKNOWN' };
    try {
        await s3.listObjects('health-check'); // Minimal check
        s3Status = { name: 'S3 Data Lake', status: 'HEALTHY' };
    } catch (e) {
        s3Status = { name: 'S3 Data Lake', status: 'UNHEALTHY' };
    }

    res.json({
        layer: 1,
        services: [airbyteStatus, s3Status]
    });
});

// Layer 2: Lineage & Transformation (The "Logic")
// GET /api/layers/scripts
// Retrieve script content from S3 for Monaco Editor
// Query param: key (s3 key)
router.get('/scripts', requireAuth, async (req: Request, res: Response) => {
    const { key } = req.query;
    if (!key || typeof key !== 'string') {
        return res.status(400).json({ error: 'Missing key query parameter' });
    }

    try {
        // In a real app, we would fetch the object content directly if small (text),
        // or return a presigned URL if the frontend fetches it.
        // For Monaco Editor value, we likely want the text content.
        // Since s3.getSignedDownloadUrl returns a URL, let's assume for this MVP 
        // we return the URL and the frontend fetches the text, OR we implement a getText util.

        // For now, let's return a signed URL so the frontend can fetch 'raw' content.
        const url = await s3.getSignedDownloadUrl(key);
        res.json({ url });
    } catch (e) {
        res.status(500).json({ error: 'Failed to get script URL' });
    }
});

export default router;
