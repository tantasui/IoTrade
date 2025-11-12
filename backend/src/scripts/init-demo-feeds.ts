/**
 * Initialize demo data feeds
 * This script creates sample IoT data feeds for demonstration purposes
 */

import { SampleDataGenerator } from '../utils/sample-data-generator';
import walrusService from '../services/walrus.service';
import suiService from '../services/sui.service';

async function initDemoFeeds() {
  console.log('🚀 Initializing demo data feeds...\n');

  try {
    // 1. Weather Station (Free Tier)
    console.log('📡 Creating Weather Station feed...');
    const weatherData = SampleDataGenerator.generateHistoricalData(
      () => SampleDataGenerator.generateWeatherData('San Francisco, CA'),
      12,
      5
    );

    const weatherBlobId = await walrusService.uploadData(weatherData, false);
    console.log(`✅ Weather data uploaded to Walrus: ${weatherBlobId}`);

    const weatherFeedId = await suiService.registerDataFeed(
      suiService.getAddress(),
      {
        name: 'SF Weather Station',
        category: 'weather',
        description: 'Real-time weather data from downtown San Francisco. Includes temperature, humidity, pressure, wind speed and conditions.',
        location: 'San Francisco, CA',
        pricePerQuery: 0,
        monthlySubscriptionPrice: 0, // Free tier
        isPremium: false,
        updateFrequency: 300, // 5 minutes
      },
      weatherBlobId
    );
    console.log(`✅ Weather feed registered: ${weatherFeedId}\n`);

    // 2. Traffic Camera (Premium Tier - Encrypted)
    console.log('📹 Creating Traffic Camera feed...');
    const trafficData = SampleDataGenerator.generateHistoricalData(
      () => SampleDataGenerator.generateTrafficData('Market St & 5th Ave', 'CAM-001'),
      12,
      1
    );

    const trafficBlobId = await walrusService.uploadData(trafficData, true);
    console.log(`✅ Traffic data uploaded to Walrus (encrypted): ${trafficBlobId}`);

    const trafficFeedId = await suiService.registerDataFeed(
      suiService.getAddress(),
      {
        name: 'Downtown Traffic Camera',
        category: 'traffic',
        description: 'Premium traffic monitoring from major intersection. Vehicle counts, average speed, congestion levels, and incident detection.',
        location: 'Market St & 5th Ave, SF',
        pricePerQuery: 100_000_000, // 0.1 SUI per query
        monthlySubscriptionPrice: 1_000_000_000, // 1 SUI per month
        isPremium: true,
        updateFrequency: 60, // 1 minute
      },
      trafficBlobId
    );
    console.log(`✅ Traffic feed registered: ${trafficFeedId}\n`);

    // 3. Air Quality Monitor (Premium Tier)
    console.log('🌫️ Creating Air Quality Monitor feed...');
    const airQualityData = SampleDataGenerator.generateHistoricalData(
      () => SampleDataGenerator.generateAirQualityData('Downtown District'),
      12,
      10
    );

    const airQualityBlobId = await walrusService.uploadData(airQualityData, true);
    console.log(`✅ Air quality data uploaded to Walrus (encrypted): ${airQualityBlobId}`);

    const airQualityFeedId = await suiService.registerDataFeed(
      suiService.getAddress(),
      {
        name: 'Downtown Air Quality Monitor',
        category: 'air_quality',
        description: 'Comprehensive air quality monitoring including PM2.5, PM10, CO2 levels, and real-time AQI calculations.',
        location: 'Downtown District, SF',
        pricePerQuery: 50_000_000, // 0.05 SUI per query
        monthlySubscriptionPrice: 500_000_000, // 0.5 SUI per month
        isPremium: true,
        updateFrequency: 600, // 10 minutes
      },
      airQualityBlobId
    );
    console.log(`✅ Air quality feed registered: ${airQualityFeedId}\n`);

    // 4. Parking Sensor Network (Pay-per-query)
    console.log('🅿️ Creating Parking Sensor Network feed...');
    const parkingData = SampleDataGenerator.generateHistoricalData(
      () => SampleDataGenerator.generateParkingData('Shopping District'),
      12,
      5
    );

    const parkingBlobId = await walrusService.uploadData(parkingData, false);
    console.log(`✅ Parking data uploaded to Walrus: ${parkingBlobId}`);

    const parkingFeedId = await suiService.registerDataFeed(
      suiService.getAddress(),
      {
        name: 'Shopping District Parking',
        category: 'parking',
        description: 'Real-time parking availability across 250 spots. Includes occupancy rates, pricing, and peak hour predictions.',
        location: 'Shopping District, SF',
        pricePerQuery: 10_000_000, // 0.01 SUI per query
        monthlySubscriptionPrice: 200_000_000, // 0.2 SUI per month
        isPremium: false,
        updateFrequency: 300, // 5 minutes
      },
      parkingBlobId
    );
    console.log(`✅ Parking feed registered: ${parkingFeedId}\n`);

    // 5. Additional Weather Station (Different Location)
    console.log('📡 Creating Oakland Weather Station feed...');
    const oaklandWeatherData = SampleDataGenerator.generateHistoricalData(
      () => SampleDataGenerator.generateWeatherData('Oakland, CA'),
      12,
      5
    );

    const oaklandWeatherBlobId = await walrusService.uploadData(oaklandWeatherData, false);
    console.log(`✅ Oakland weather data uploaded to Walrus: ${oaklandWeatherBlobId}`);

    const oaklandWeatherFeedId = await suiService.registerDataFeed(
      suiService.getAddress(),
      {
        name: 'Oakland Weather Station',
        category: 'weather',
        description: 'Free weather monitoring from Oakland. Temperature, humidity, atmospheric pressure, and current conditions.',
        location: 'Oakland, CA',
        pricePerQuery: 0,
        monthlySubscriptionPrice: 100_000_000, // 0.1 SUI per month
        isPremium: false,
        updateFrequency: 300,
      },
      oaklandWeatherBlobId
    );
    console.log(`✅ Oakland weather feed registered: ${oaklandWeatherFeedId}\n`);

    console.log('✨ Demo initialization complete!\n');
    console.log('📊 Summary:');
    console.log(`   - 5 data feeds created`);
    console.log(`   - 2 free tier feeds`);
    console.log(`   - 3 premium feeds`);
    console.log(`   - 2 encrypted feeds (Seal)`);
    console.log(`   - Data stored on Walrus`);
    console.log(`   - Smart contracts deployed on Sui\n`);

    console.log('🎯 Next steps:');
    console.log('   1. Start the backend server: npm run dev');
    console.log('   2. Start the frontend: cd ../frontend && npm run dev');
    console.log('   3. Connect your Sui wallet');
    console.log('   4. Browse feeds at http://localhost:3000/consumer');
    console.log('   5. Manage feeds at http://localhost:3000/provider\n');

  } catch (error: any) {
    console.error('❌ Error initializing demo feeds:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  initDemoFeeds()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export default initDemoFeeds;
