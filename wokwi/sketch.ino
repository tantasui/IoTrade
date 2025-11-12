#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

#define DHTPIN 4
#define DHTTYPE DHT22
#define LED_BLUE 2
#define LED_GREEN 15
#define LED_RED 13

DHT dht(DHTPIN, DHTTYPE);

// ⚠️ UPDATE THESE VALUES ⚠️
const char* ssid = "Wokwi-GUEST";
const char* password = "";
// Use Wokwi Private IoT Gateway (requires port forwarding setup)
// Replace YOUR_FEED_ID with your actual feed ID from provider dashboard
const char* feedId = "0x2fca1ed29725e582fd31525e2e98523b735722f50ce846ed8528bdb8ce27caff";
// Replace YOUR_PROVIDER_API_KEY with your pk_xxx API key from provider dashboard
const char* apiKey = "YOUR_PROVIDER_API_KEY"; // pk_xxx format

// Configuration
const unsigned long updateInterval = 300000; // 5 minutes (300000ms)
const char* deviceId = "wokwi-esp32-001";
const char* location = "Wokwi Simulation Lab";

// Build the feed-specific endpoint URL
String getServerUrl() {
  return "http://host.wokwi.internal:3001/api/iot/feeds/" + String(feedId) + "/update";
}

unsigned long lastUpdate = 0;
int readingCount = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);

  // Initialize LEDs
  pinMode(LED_BLUE, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED, OUTPUT);

  // Startup sequence
  blinkLED(LED_BLUE, 3);

  Serial.println("\n");
  Serial.println("╔════════════════════════════════════════╗");
  Serial.println("║   IoT Weather Station v1.0             ║");
  Serial.println("║   Data Marketplace Device              ║");
  Serial.println("╚════════════════════════════════════════╝");
  Serial.println();

  // Initialize DHT sensor
  dht.begin();
  Serial.println("🌡️  DHT22 sensor initialized");

  // Connect to WiFi
  connectWiFi();

  Serial.println();
  Serial.println("📡 Starting data transmission...");
  Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  Serial.println();
}

void loop() {
  unsigned long currentMillis = millis();

  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️  WiFi disconnected. Reconnecting...");
    connectWiFi();
  }

  // Send data at specified interval
  if (currentMillis - lastUpdate >= updateInterval || lastUpdate == 0) {
    lastUpdate = currentMillis;
    readingCount++;

    blinkLED(LED_BLUE, 1);
    readAndSendData();
  }

  delay(1000);
}

void connectWiFi() {
  Serial.print("📶 Connecting to WiFi");
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" ✅");
    Serial.print("   IP Address: ");
    Serial.println(WiFi.localIP());
    blinkLED(LED_GREEN, 2);
  } else {
    Serial.println(" ❌");
    Serial.println("   Failed to connect!");
    blinkLED(LED_RED, 3);
  }
}

void readAndSendData() {
  // Read sensor data
  float temperature = dht.readTemperature(true); // Fahrenheit
  float humidity = dht.readHumidity();

  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("❌ Failed to read from DHT sensor!");
    blinkLED(LED_RED, 2);
    return;
  }

  // Calculate additional mock data
  float pressure = 1013.25 + (random(-30, 30) / 10.0);
  float windSpeed = random(0, 150) / 10.0; // 0-15 mph
  const char* directions[] = {"N", "NE", "E", "SE", "S", "SW", "W", "NW"};
  const char* windDirection = directions[random(0, 8)];
  const char* conditions[] = {"Clear", "Partly Cloudy", "Cloudy", "Light Rain", "Sunny"};
  const char* currentConditions = conditions[random(0, 5)];

  // Display readings
  Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  Serial.printf("📊 Reading #%d\n", readingCount);
  Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  Serial.printf("   🌡️  Temperature: %.1f°F\n", temperature);
  Serial.printf("   💧 Humidity: %.1f%%\n", humidity);
  Serial.printf("   🌬️  Pressure: %.2f hPa\n", pressure);
  Serial.printf("   💨 Wind: %.1f mph %s\n", windSpeed, windDirection);
  Serial.printf("   ☁️  Conditions: %s\n", currentConditions);
  Serial.printf("   📍 Location: %s\n", location);
  Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Send to API
  sendDataToAPI(temperature, humidity, pressure, windSpeed, windDirection, currentConditions);
}

void sendDataToAPI(float temp, float humidity, float pressure, float windSpeed, const char* windDirection, const char* conditions) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi not connected!");
    blinkLED(LED_RED, 2);
    return;
  }

  // Check if API key is configured
  if (strcmp(apiKey, "YOUR_PROVIDER_API_KEY") == 0) {
    Serial.println("❌ API Key not configured!");
    Serial.println("   Please update the apiKey variable with your pk_xxx key from provider dashboard");
    blinkLED(LED_RED, 3);
    return;
  }

  // Validate API key format (must start with pk_ for provider keys)
  if (strncmp(apiKey, "pk_", 3) != 0) {
    Serial.println("❌ Invalid API Key format!");
    Serial.println("   Provider API key must start with 'pk_' (not 'sk_')");
    Serial.println("   Get your provider key from: Provider Dashboard > Your Feed > API Keys");
    blinkLED(LED_RED, 3);
    return;
  }

  WiFiClient client;
  HTTPClient http;
  
  String serverUrl = getServerUrl();
  Serial.println("📡 Connecting to local backend via Private Gateway...");
  Serial.println("   URL: " + serverUrl);
  
  // Use regular WiFiClient for HTTP (Private Gateway handles the connection)
  http.begin(client, serverUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", apiKey); // API key authentication
  http.setTimeout(20000); // 20 second timeout
  
  Serial.println("✅ HTTP client initialized");

  // Create JSON payload (feed-specific endpoint format)
  StaticJsonDocument<1024> doc;
  doc["deviceId"] = deviceId; // Now part of the payload
  
  JsonObject data = doc.createNestedObject("data");
  data["timestamp"] = millis();
  data["temperature"] = round(temp * 10) / 10.0;
  data["humidity"] = round(humidity * 10) / 10.0;
  data["pressure"] = round(pressure * 100) / 100.0;
  data["windSpeed"] = round(windSpeed * 10) / 10.0;
  data["windDirection"] = windDirection;
  data["conditions"] = conditions;
  data["location"] = location;
  data["deviceType"] = "ESP32+DHT22";
  data["readingNumber"] = readingCount;

  String jsonString;
  serializeJson(doc, jsonString);

  Serial.println("📤 Sending to API...");
  Serial.println("   URL: " + serverUrl);
  Serial.printf("   Payload size: %d bytes\n", jsonString.length());
  Serial.println("   WiFi Status: " + String(WiFi.status()));
  Serial.println("   RSSI: " + String(WiFi.RSSI()) + " dBm");

  Serial.println("⏳ Sending POST request...");
  int httpResponseCode = http.POST(jsonString);
  Serial.println("📥 Response received: " + String(httpResponseCode));

  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.printf("✅ Response Code: %d\n", httpResponseCode);

    // Parse response
    StaticJsonDocument<512> responseDoc;
    DeserializationError error = deserializeJson(responseDoc, response);

    if (!error && responseDoc["success"] == true) {
      const char* blobId = responseDoc["blobId"];
      Serial.println("   ✅ Data uploaded successfully!");
      if (blobId) {
        Serial.printf("   🗄️  Walrus Blob ID: %s\n", blobId);
      }
      blinkLED(LED_GREEN, 3);
    } else {
      Serial.println("   ⚠️  Server response not successful");
      Serial.println("   Response: " + response);
      blinkLED(LED_RED, 1);
    }
  } else {
    Serial.printf("❌ HTTP Error: %d\n", httpResponseCode);
    Serial.println("   " + http.errorToString(httpResponseCode));
    blinkLED(LED_RED, 3);
  }

  http.end();
  Serial.println();
}

void blinkLED(int pin, int times) {
  for (int i = 0; i < times; i++) {
    digitalWrite(pin, HIGH);
    delay(100);
    digitalWrite(pin, LOW);
    delay(100);
  }
}
