/**
 * Sample IoT Data Generator for Demo Purposes
 * Generates realistic IoT data for different feed types
 */

export interface WeatherData {
  timestamp: number;
  temperature: number; // Fahrenheit
  humidity: number; // Percentage
  pressure: number; // hPa
  windSpeed: number; // mph
  windDirection: string;
  conditions: string;
  location: string;
}

export interface TrafficData {
  timestamp: number;
  vehicleCount: number;
  averageSpeed: number; // mph
  congestionLevel: 'low' | 'medium' | 'high' | 'severe';
  incidents: number;
  location: string;
  cameraId: string;
}

export interface AirQualityData {
  timestamp: number;
  pm25: number; // μg/m³
  pm10: number; // μg/m³
  co2: number; // ppm
  aqi: number; // Air Quality Index (0-500)
  aqiCategory: string;
  location: string;
}

export interface ParkingData {
  timestamp: number;
  totalSpots: number;
  availableSpots: number;
  occupancyRate: number; // Percentage
  pricePerHour: number;
  peakHours: string[];
  location: string;
}

export class SampleDataGenerator {
  /**
   * Generate weather station data
   */
  static generateWeatherData(location: string = 'San Francisco, CA'): WeatherData {
    const conditions = ['Clear', 'Partly Cloudy', 'Cloudy', 'Light Rain', 'Sunny'];
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

    // Base values with some randomness
    const baseTemp = 68;
    const temperature = baseTemp + (Math.random() * 20 - 10);
    const humidity = 40 + Math.random() * 40;
    const pressure = 1010 + Math.random() * 20;
    const windSpeed = Math.random() * 15;

    return {
      timestamp: Date.now(),
      temperature: Math.round(temperature * 10) / 10,
      humidity: Math.round(humidity * 10) / 10,
      pressure: Math.round(pressure * 10) / 10,
      windSpeed: Math.round(windSpeed * 10) / 10,
      windDirection: directions[Math.floor(Math.random() * directions.length)],
      conditions: conditions[Math.floor(Math.random() * conditions.length)],
      location,
    };
  }

  /**
   * Generate traffic camera data
   */
  static generateTrafficData(location: string = 'Market St & 5th Ave', cameraId: string = 'CAM-001'): TrafficData {
    const hour = new Date().getHours();
    const isPeakHour = (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18);

    let baseVehicleCount = 50;
    let baseSpeed = 35;

    if (isPeakHour) {
      baseVehicleCount = 150;
      baseSpeed = 15;
    }

    const vehicleCount = Math.floor(baseVehicleCount + (Math.random() * 40 - 20));
    const averageSpeed = Math.max(5, Math.floor(baseSpeed + (Math.random() * 10 - 5)));

    let congestionLevel: 'low' | 'medium' | 'high' | 'severe';
    if (averageSpeed > 30) congestionLevel = 'low';
    else if (averageSpeed > 20) congestionLevel = 'medium';
    else if (averageSpeed > 10) congestionLevel = 'high';
    else congestionLevel = 'severe';

    const incidents = Math.random() > 0.9 ? 1 : 0;

    return {
      timestamp: Date.now(),
      vehicleCount,
      averageSpeed,
      congestionLevel,
      incidents,
      location,
      cameraId,
    };
  }

  /**
   * Generate air quality monitor data
   */
  static generateAirQualityData(location: string = 'Downtown District'): AirQualityData {
    const pm25 = 5 + Math.random() * 50;
    const pm10 = pm25 * 1.5 + Math.random() * 20;
    const co2 = 350 + Math.random() * 200;

    // Calculate AQI (simplified)
    let aqi = Math.floor(pm25 * 4);
    let aqiCategory: string;

    if (aqi <= 50) aqiCategory = 'Good';
    else if (aqi <= 100) aqiCategory = 'Moderate';
    else if (aqi <= 150) aqiCategory = 'Unhealthy for Sensitive Groups';
    else if (aqi <= 200) aqiCategory = 'Unhealthy';
    else if (aqi <= 300) aqiCategory = 'Very Unhealthy';
    else aqiCategory = 'Hazardous';

    return {
      timestamp: Date.now(),
      pm25: Math.round(pm25 * 10) / 10,
      pm10: Math.round(pm10 * 10) / 10,
      co2: Math.round(co2),
      aqi,
      aqiCategory,
      location,
    };
  }

  /**
   * Generate parking sensor network data
   */
  static generateParkingData(location: string = 'Shopping District'): ParkingData {
    const totalSpots = 250;
    const hour = new Date().getHours();
    const isPeakHour = hour >= 10 && hour <= 20;

    let baseOccupancy = 0.4; // 40%
    if (isPeakHour) {
      baseOccupancy = 0.8; // 80%
    }

    const occupancy = Math.min(1, Math.max(0, baseOccupancy + (Math.random() * 0.2 - 0.1)));
    const availableSpots = Math.floor(totalSpots * (1 - occupancy));

    const pricePerHour = isPeakHour ? 5 : 3;
    const peakHours = ['10:00-12:00', '14:00-16:00', '18:00-20:00'];

    return {
      timestamp: Date.now(),
      totalSpots,
      availableSpots,
      occupancyRate: Math.round(occupancy * 100),
      pricePerHour,
      peakHours,
      location,
    };
  }

  /**
   * Generate a batch of historical data points
   */
  static generateHistoricalData<T>(
    generator: () => T,
    count: number = 10,
    intervalMinutes: number = 5
  ): T[] {
    const data: T[] = [];
    const now = Date.now();

    for (let i = count - 1; i >= 0; i--) {
      const timestamp = now - (i * intervalMinutes * 60 * 1000);
      const dataPoint = generator();
      (dataPoint as any).timestamp = timestamp;
      data.push(dataPoint);
    }

    return data;
  }
}

// Export individual generators for convenience
export const generateWeatherData = SampleDataGenerator.generateWeatherData;
export const generateTrafficData = SampleDataGenerator.generateTrafficData;
export const generateAirQualityData = SampleDataGenerator.generateAirQualityData;
export const generateParkingData = SampleDataGenerator.generateParkingData;
