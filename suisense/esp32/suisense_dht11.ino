/**
 * SuiSense DHT11 Sensor — ESP32 Firmware
 *
 * Reads real temperature/humidity from a DHT11 sensor
 * and POSTs to the SuiSense sensor server which bridges
 * data to Walrus storage and Sui blockchain.
 *
 * Adapted from the working IoTrade ESP32 firmware with
 * enhanced diagnostics, validation, and LED indicators.
 *
 * Wiring:
 *   DHT11 Pin 1 (VCC)  -> ESP32 3.3V
 *   DHT11 Pin 2 (DATA) -> ESP32 GPIO 4
 *   DHT11 Pin 3 (NC)   -> Not connected
 *   DHT11 Pin 4 (GND)  -> ESP32 GND
 *
 * LEDs:
 *   GPIO 2  -> Built-in blue LED (sending indicator)
 *   GPIO 15 -> Green LED (success)
 *   GPIO 13 -> Red LED (error)
 *
 * Libraries Required (install via Arduino Library Manager):
 *   - DHT sensor library by Adafruit
 *   - Adafruit Unified Sensor
 *   - ArduinoJson by Benoit Blanchon
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// ===================== CONFIGURATION =====================
const char* ssid       = "YOUR_WIFI_SSID";
const char* password   = "YOUR_WIFI_PASSWORD";
const char* serverHost = "192.168.1.100";  // IP of machine running sensor server
const int   serverPort = 3001;
const char* deviceId   = "esp32-dht11-001";
const char* location   = "Local";

// DHT11 sensor config
#define DHTPIN  4
#define DHTTYPE DHT11

// LED pins
#define LED_BLUE  2
#define LED_GREEN 15
#define LED_RED   13

// Update interval (milliseconds)
const unsigned long updateInterval = 60000; // 60 seconds
// =========================================================

DHT dht(DHTPIN, DHTTYPE);
unsigned long lastUpdate = 0;
int readingCount = 0;
int consecutiveErrors = 0;
int successfulReads = 0;

// DHT11 validation ranges
const float MIN_TEMP = 0.0;     // DHT11 spec: 0C to 50C
const float MAX_TEMP = 50.0;
const float MIN_HUMIDITY = 20.0;
const float MAX_HUMIDITY = 100.0;

void setup() {
  Serial.begin(115200);
  delay(1000);

  // Initialize LEDs
  pinMode(LED_BLUE, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED, OUTPUT);

  blinkLED(LED_BLUE, 3);

  Serial.println("\n");
  Serial.println("========================================");
  Serial.println("  SuiSense DHT11 Sensor");
  Serial.println("  ESP32 -> Walrus -> Sui Blockchain");
  Serial.println("========================================");
  Serial.println();

  // Hardware config check
  Serial.println("HARDWARE CONFIGURATION");
  Serial.println("----------------------------------------");
  Serial.printf("  DHT Pin: GPIO %d\n", DHTPIN);
  Serial.println("  DHT Type: DHT11");
  Serial.println("  Wiring:");
  Serial.println("    DHT11 Pin 1 (VCC)  -> ESP32 3.3V");
  Serial.println("    DHT11 Pin 2 (DATA) -> ESP32 GPIO 4");
  Serial.println("    DHT11 Pin 3 (NC)   -> Not connected");
  Serial.println("    DHT11 Pin 4 (GND)  -> ESP32 GND");
  Serial.println("----------------------------------------");
  Serial.println();

  // Initialize DHT sensor
  Serial.println("Initializing DHT11 sensor...");
  pinMode(DHTPIN, INPUT_PULLUP);
  dht.begin();

  Serial.println("  Waiting for sensor stabilization (3 seconds)...");
  delay(3000);
  Serial.println("  DHT11 initialization complete");
  Serial.println();

  // Sensor diagnostic
  Serial.println("SENSOR DIAGNOSTIC TEST");
  Serial.println("----------------------------------------");
  testDHTSensor();
  Serial.println("----------------------------------------");
  Serial.println();

  // Connect to WiFi
  connectWiFi();

  Serial.println();
  Serial.println("[SuiSense] Starting data transmission...");
  Serial.printf("[SuiSense] Update interval: %lu ms\n", updateInterval);
  Serial.printf("[SuiSense] Target: http://%s:%d/api/sensor/update\n", serverHost, serverPort);
  Serial.println();
}

void loop() {
  unsigned long currentMillis = millis();

  // Check WiFi
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Disconnected. Reconnecting...");
    digitalWrite(LED_BLUE, LOW);
    connectWiFi();
  }

  // Send data at interval
  if (currentMillis - lastUpdate >= updateInterval || lastUpdate == 0) {
    lastUpdate = currentMillis;
    readingCount++;
    blinkLED(LED_BLUE, 1);
    readAndSendData();
  }

  delay(1000);
}

void testDHTSensor() {
  Serial.println("  Performing 5 test reads...");
  Serial.println();

  int validReads = 0;

  for (int i = 1; i <= 5; i++) {
    Serial.printf("  Test #%d: ", i);

    float temp = dht.readTemperature(); // Celsius
    float humidity = dht.readHumidity();

    bool tempValid = !isnan(temp) && temp >= MIN_TEMP && temp <= MAX_TEMP;
    bool humidityValid = !isnan(humidity) && humidity >= MIN_HUMIDITY && humidity <= MAX_HUMIDITY;

    if (tempValid && humidityValid) {
      Serial.printf("%.1f C, %.1f%% RH  OK\n", temp, humidity);
      validReads++;
    } else {
      Serial.printf("T=%s H=%s  FAIL\n",
        isnan(temp) ? "NaN" : String(temp).c_str(),
        isnan(humidity) ? "NaN" : String(humidity).c_str());
    }

    if (i < 5) delay(1500);
  }

  Serial.printf("\n  Result: %d/5 valid reads\n", validReads);

  if (validReads == 0) {
    Serial.println("\n  CRITICAL: No valid sensor reads!");
    Serial.println("  Check wiring before continuing.");
    blinkLED(LED_RED, 5);
  }
}

void connectWiFi() {
  Serial.print("[WiFi] Connecting");
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" OK");
    Serial.printf("[WiFi] IP: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("[WiFi] Signal: %d dBm\n", WiFi.RSSI());
    digitalWrite(LED_BLUE, HIGH);
    blinkLED(LED_GREEN, 2);
  } else {
    Serial.println(" FAILED");
    digitalWrite(LED_BLUE, LOW);
    blinkLED(LED_RED, 3);
  }
}

void readAndSendData() {
  Serial.printf("\n--- Reading #%d ---\n", readingCount);

  // Read sensor
  float temperature = dht.readTemperature(); // Celsius
  delay(100);
  float humidity = dht.readHumidity();

  // Validate
  bool tempValid = !isnan(temperature) && temperature >= MIN_TEMP && temperature <= MAX_TEMP;
  bool humidityValid = !isnan(humidity) && humidity >= MIN_HUMIDITY && humidity <= MAX_HUMIDITY;

  if (!tempValid || !humidityValid) {
    consecutiveErrors++;
    Serial.println("  SENSOR ERROR!");
    Serial.printf("  Temperature: %s\n", isnan(temperature) ? "NaN" : String(temperature).c_str());
    Serial.printf("  Humidity: %s\n", isnan(humidity) ? "NaN" : String(humidity).c_str());
    Serial.printf("  Consecutive errors: %d\n", consecutiveErrors);
    blinkLED(LED_RED, 3);
    return;
  }

  // Compute heat index in Celsius
  float heatIndex = dht.computeHeatIndex(temperature, humidity, false);

  consecutiveErrors = 0;
  successfulReads++;

  Serial.printf("  Temperature: %.1f C\n", temperature);
  Serial.printf("  Humidity:    %.1f %%\n", humidity);
  Serial.printf("  Heat Index:  %.1f C\n", heatIndex);
  Serial.printf("  Successful reads: %d\n", successfulReads);

  sendToServer(temperature, humidity, heatIndex);
}

void sendToServer(float temperature, float humidity, float heatIndex) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] WiFi not connected!");
    blinkLED(LED_RED, 2);
    return;
  }

  WiFiClient client;
  HTTPClient http;

  String url = String("http://") + serverHost + ":" + String(serverPort) + "/api/sensor/update";
  Serial.println("[HTTP] POST " + url);

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(20000);

  // Build JSON payload
  StaticJsonDocument<512> doc;
  doc["deviceId"] = deviceId;

  JsonObject data = doc.createNestedObject("data");
  data["temperature"] = round(temperature * 10) / 10.0;
  data["humidity"]    = round(humidity * 10) / 10.0;
  data["heatIndex"]   = round(heatIndex * 10) / 10.0;
  data["timestamp"]   = millis();
  data["location"]    = location;
  data["deviceType"]  = "ESP32+DHT11";
  data["readingNumber"]   = readingCount;
  data["successfulReads"] = successfulReads;

  String jsonString;
  serializeJson(doc, jsonString);

  Serial.printf("[HTTP] Payload: %d bytes\n", jsonString.length());

  unsigned long requestStart = millis();
  int httpCode = http.POST(jsonString);
  unsigned long requestDuration = millis() - requestStart;

  Serial.printf("[HTTP] Response: %d (%lu ms)\n", httpCode, requestDuration);

  if (httpCode > 0) {
    String response = http.getString();

    if (httpCode >= 200 && httpCode < 300) {
      StaticJsonDocument<512> resDoc;
      DeserializationError err = deserializeJson(resDoc, response);

      if (!err && resDoc["success"] == true) {
        const char* blobId = resDoc["blobId"];
        Serial.println("[HTTP] OK - uploaded to Walrus");
        if (blobId) {
          Serial.printf("[HTTP] Blob ID: %s\n", blobId);
        }
        blinkLED(LED_GREEN, 2);
      } else {
        Serial.println("[HTTP] Unexpected response format");
        Serial.println(response);
        blinkLED(LED_RED, 1);
      }
    } else {
      Serial.printf("[HTTP] Error %d: %s\n", httpCode, response.c_str());
      blinkLED(LED_RED, 3);
    }
  } else {
    Serial.printf("[HTTP] Failed: %s\n", http.errorToString(httpCode).c_str());

    if (httpCode == -5) {
      Serial.println("  Connection lost - check server is running");
    } else if (httpCode == -1) {
      Serial.println("  Connection refused - check IP and port");
    } else if (httpCode == -11) {
      Serial.println("  Timeout - request took too long");
    }

    blinkLED(LED_RED, 4);
  }

  http.end();
}

void blinkLED(int pin, int times) {
  for (int i = 0; i < times; i++) {
    digitalWrite(pin, HIGH);
    delay(100);
    digitalWrite(pin, LOW);
    delay(100);
  }
}
