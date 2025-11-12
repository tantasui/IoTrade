/**
 * Provider IoT Device Example - Sending Data to Walrus
 * 
 * This example demonstrates how an IoT device (ESP32/Arduino) can:
 * 1. Read sensor data
 * 2. Send data to the Data Marketplace API
 * 3. Upload data to Walrus storage
 * 
 * Prerequisites:
 * - ESP32 or compatible board
 * - WiFi connection
 * - Provider API key (pk_xxx...) from the marketplace
 * - Feed ID (created via provider dashboard)
 * 
 * Libraries Required:
 * - WiFi (built-in)
 * - HTTPClient (built-in)
 * - ArduinoJson (install via Library Manager)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ⚠️ UPDATE THESE VALUES ⚠️
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* apiBaseUrl = "http://localhost:3001";  // Change to your API URL
const char* feedId = "0x_your_feed_id_here";
const char* providerApiKey = "pk_your_provider_api_key_here";  // Must start with pk_

// Configuration
const unsigned long updateInterval = 300000; // 5 minutes (300000ms)
const char* deviceId = "esp32-device-001";
const char* location = "Building A - Floor 3";

unsigned long lastUpdate = 0;
int readingCount = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n");
  Serial.println("╔════════════════════════════════════════╗");
  Serial.println("║   IoT Data Provider Device            ║");
  Serial.println("║   Data Marketplace Example             ║");
  Serial.println("╚════════════════════════════════════════╝");
  Serial.println();

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
  } else {
    Serial.println(" ❌");
    Serial.println("   Failed to connect!");
  }
}

void readAndSendData() {
  // Read sensor data (example: DHT22, BMP280, etc.)
  // Replace this with your actual sensor reading code
  float temperature = 72.5 + (random(-50, 50) / 10.0);  // Mock data
  float humidity = 45.0 + (random(-20, 20) / 10.0);     // Mock data
  float pressure = 1013.25 + (random(-30, 30) / 10.0);  // Mock data

  // Display readings
  Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  Serial.printf("📊 Reading #%d\n", readingCount);
  Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  Serial.printf("   🌡️  Temperature: %.1f°F\n", temperature);
  Serial.printf("   💧 Humidity: %.1f%%\n", humidity);
  Serial.printf("   🌬️  Pressure: %.2f hPa\n", pressure);
  Serial.printf("   📍 Location: %s\n", location);
  Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Send to API
  sendDataToAPI(temperature, humidity, pressure);
}

void sendDataToAPI(float temp, float humidity, float pressure) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi not connected!");
    return;
  }

  // Validate API key
  if (strcmp(providerApiKey, "pk_your_provider_api_key_here") == 0) {
    Serial.println("❌ API Key not configured!");
    Serial.println("   Please update the providerApiKey variable with your pk_xxx key");
    return;
  }

  // Validate API key format (must start with pk_ for provider keys)
  if (strncmp(providerApiKey, "pk_", 3) != 0) {
    Serial.println("❌ Invalid API Key format!");
    Serial.println("   Provider API key must start with 'pk_'");
    return;
  }

  WiFiClient client;
  HTTPClient http;
  
  // Build feed-specific endpoint URL
  String serverUrl = String(apiBaseUrl) + "/api/iot/feeds/" + String(feedId) + "/update";
  
  Serial.println("📡 Connecting to API...");
  Serial.println("   URL: " + serverUrl);
  
  http.begin(client, serverUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", providerApiKey);
  http.setTimeout(20000); // 20 second timeout
  
  Serial.println("✅ HTTP client initialized");

  // Create JSON payload
  StaticJsonDocument<1024> doc;
  doc["deviceId"] = deviceId;
  
  JsonObject data = doc.createNestedObject("data");
  data["timestamp"] = millis();
  data["temperature"] = round(temp * 10) / 10.0;
  data["humidity"] = round(humidity * 10) / 10.0;
  data["pressure"] = round(pressure * 100) / 100.0;
  data["location"] = location;
  data["deviceType"] = "ESP32";
  data["readingNumber"] = readingCount;

  String jsonString;
  serializeJson(doc, jsonString);

  Serial.println("📤 Sending to API...");
  Serial.printf("   Payload size: %d bytes\n", jsonString.length());

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
    } else {
      Serial.println("   ⚠️  Server response not successful");
      Serial.println("   Response: " + response);
    }
  } else {
    Serial.printf("❌ HTTP Error: %d\n", httpResponseCode);
    Serial.println("   " + http.errorToString(httpResponseCode));
  }

  http.end();
  Serial.println();
}

