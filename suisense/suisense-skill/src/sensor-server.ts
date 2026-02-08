import express from 'express';
import { config } from './config.js';
import { uploadData } from './walrus-store.js';
import { updateFeedData, getAddress } from './sui-bridge.js';

interface SensorReading {
  deviceId: string;
  data: Record<string, any>;
  blobId: string;
  receivedAt: number;
}

const readings: SensorReading[] = [];
const MAX_READINGS = 100;
const startTime = Date.now();

const app = express();
app.use(express.json());

// POST /api/sensor/update — ESP32 hits this endpoint
app.post('/api/sensor/update', async (req, res) => {
  const requestId = `req_${Date.now()}`;
  console.log(`[${requestId}] Sensor update received`);

  try {
    const { deviceId, data } = req.body;

    if (!data) {
      res.status(400).json({ success: false, error: 'data is required' });
      return;
    }

    // Enrich data with metadata
    const enrichedData = {
      ...data,
      deviceId: deviceId || 'unknown',
      receivedAt: Date.now(),
      source: 'iot_device',
    };

    // Upload to Walrus
    console.log(`[${requestId}] Uploading to Walrus...`);
    const blobId = await uploadData(enrichedData);
    console.log(`[${requestId}] Walrus blob: ${blobId}`);

    // Store in memory
    const reading: SensorReading = {
      deviceId: deviceId || 'unknown',
      data: enrichedData,
      blobId,
      receivedAt: Date.now(),
    };
    readings.unshift(reading);
    if (readings.length > MAX_READINGS) readings.pop();

    // Update on-chain if feed ID is configured
    const feedId = config.dataFeedId;
    if (feedId) {
      try {
        await updateFeedData(feedId, blobId);
        console.log(`[${requestId}] On-chain update done`);
      } catch (err: any) {
        console.warn(`[${requestId}] On-chain update failed: ${err.message}`);
      }
    }

    res.json({
      success: true,
      blobId,
      feedId: feedId || null,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error(`[${requestId}] Error:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/sensor/latest — latest reading
app.get('/api/sensor/latest', (_req, res) => {
  if (readings.length === 0) {
    res.json({ success: true, data: null, message: 'No readings yet' });
    return;
  }
  res.json({ success: true, data: readings[0] });
});

// GET /api/sensor/readings — last 50 readings
app.get('/api/sensor/readings', (_req, res) => {
  res.json({ success: true, data: readings.slice(0, 50) });
});

// GET /api/sensor/stats — feed stats
app.get('/api/sensor/stats', (_req, res) => {
  res.json({
    success: true,
    totalReadings: readings.length,
    lastReading: readings[0]?.receivedAt || null,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    feedId: config.dataFeedId || null,
    address: (() => { try { return getAddress(); } catch { return null; } })(),
  });
});

// GET /api/sensor/health — health check
app.get('/api/sensor/health', (_req, res) => {
  const lastReadingAge = readings.length > 0
    ? Math.floor((Date.now() - readings[0].receivedAt) / 1000)
    : null;

  res.json({
    success: true,
    status: 'running',
    lastReadingAgeSec: lastReadingAge,
    totalReadings: readings.length,
    uptime: Math.floor((Date.now() - startTime) / 1000),
  });
});

app.listen(config.sensor.port, () => {
  let address = '(no key set)';
  try { address = getAddress(); } catch { /* no key configured */ }
  console.log(`[SuiSense] Sensor server running on port ${config.sensor.port}`);
  console.log(`[SuiSense] Address: ${address}`);
  console.log(`[SuiSense] Feed ID: ${config.dataFeedId || '(not set)'}`);
  console.log(`[SuiSense] Endpoints:`);
  console.log(`  POST /api/sensor/update   — receive ESP32 data`);
  console.log(`  GET  /api/sensor/latest   — latest reading`);
  console.log(`  GET  /api/sensor/readings — last 50 readings`);
  console.log(`  GET  /api/sensor/stats    — feed stats`);
  console.log(`  GET  /api/sensor/health   — health check`);
});
