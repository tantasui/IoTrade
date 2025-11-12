/**
 * Mock IoT Device Simulator
 * Simulates a weather station sending data to the marketplace
 * Use this as a backup if Wokwi has connectivity issues
 */

import axios from 'axios';
import { generateWeatherData } from '../utils/sample-data-generator';

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3001';
const FEED_ID = process.env.IOT_FEED_ID || 'YOUR_FEED_ID_HERE';
const PROVIDER_ADDRESS = process.env.IOT_PROVIDER_ADDRESS || 'YOUR_WALLET_ADDRESS';
const DEVICE_ID = 'mock-device-001';
const LOCATION = 'Virtual IoT Lab';
const UPDATE_INTERVAL = 30000; // 30 seconds for demo (normally 5 minutes)

let readingCount = 0;

async function sendData() {
  readingCount++;

  try {
    // Generate realistic weather data
    const weatherData = generateWeatherData(LOCATION);

    // Add device-specific metadata
    const payload = {
      feedId: FEED_ID,
      deviceId: DEVICE_ID,
      provider: PROVIDER_ADDRESS,
      data: {
        ...weatherData,
        deviceType: 'Mock Simulator',
        readingNumber: readingCount,
      }
    };

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Reading #${readingCount}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   🌡️  Temperature: ${weatherData.temperature.toFixed(1)}°F`);
    console.log(`   💧 Humidity: ${weatherData.humidity.toFixed(1)}%`);
    console.log(`   🌬️  Pressure: ${weatherData.pressure.toFixed(2)} hPa`);
    console.log(`   💨 Wind: ${weatherData.windSpeed.toFixed(1)} mph ${weatherData.windDirection}`);
    console.log(`   ☁️  Conditions: ${weatherData.conditions}`);
    console.log(`   📍 Location: ${LOCATION}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const response = await axios.post(
      `${API_URL}/api/iot/update`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    if (response.data.success) {
      console.log('✅ Data uploaded successfully!');
      if (response.data.blobId) {
        console.log(`   🗄️  Walrus Blob ID: ${response.data.blobId}`);
      }
    } else {
      console.log('⚠️  Server response not successful');
      console.log('   Response:', response.data);
    }

  } catch (error: any) {
    console.error('❌ Error sending data:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }

  console.log();
}

// Main execution
console.log('\n');
console.log('╔════════════════════════════════════════╗');
console.log('║   Mock IoT Weather Station v1.0        ║');
console.log('║   Data Marketplace Device Simulator    ║');
console.log('╚════════════════════════════════════════╝');
console.log();
console.log('📡 Configuration:');
console.log(`   API URL: ${API_URL}`);
console.log(`   Feed ID: ${FEED_ID}`);
console.log(`   Provider: ${PROVIDER_ADDRESS}`);
console.log(`   Device ID: ${DEVICE_ID}`);
console.log(`   Update Interval: ${UPDATE_INTERVAL / 1000}s`);
console.log();
console.log('🚀 Starting data transmission...');
console.log();

// Send immediately, then on interval
sendData();
const interval = setInterval(sendData, UPDATE_INTERVAL);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Stopping mock IoT device...');
  clearInterval(interval);
  console.log('👋 Goodbye!');
  process.exit(0);
});

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
