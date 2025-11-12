# Wokwi IoT Device Simulator

This folder contains a Wokwi ESP32 simulator that acts as a real IoT weather station, sending data to your marketplace.

## 🎯 Quick Start

### Option 1: Use Wokwi Online (Easiest)

1. Go to https://wokwi.com/projects/new/esp32
2. Copy the contents of `sketch.ino` into the code editor
3. Click the gear icon (⚙️) next to "diagram.json"
4. Paste the contents of `diagram.json`
5. Click "Start Simulation"

### Option 2: Use This Project Directly

1. Visit: https://wokwi.com
2. Upload the files from this folder
3. Start simulation

## 📝 Configuration

Before running, update these values in `sketch.ino`:

```cpp
// Line 10-12: Your API configuration
const char* serverUrl = "YOUR_API_URL/api/iot/update";
const char* feedId = "YOUR_FEED_ID";
const char* providerAddress = "YOUR_WALLET_ADDRESS";
```

### Getting Your Values:

1. **API URL**:
   - Local: `http://localhost:3001/api/iot/update`
   - Production: Use ngrok to expose your local server (see below)

2. **Feed ID**:
   - Create a feed in the Provider Dashboard
   - Copy the feed ID from the URL or response

3. **Provider Address**:
   - Your Sui wallet address from the wallet extension

## 🌐 Exposing Local Backend (Wokwi needs public URL)

Wokwi needs to reach your local API. Use ngrok:

```bash
# Install ngrok
npm install -g ngrok

# Expose your backend
ngrok http 3001

# Copy the https URL (e.g., https://abc123.ngrok.io)
# Use: https://abc123.ngrok.io/api/iot/update
```

## 📊 What It Does

The simulator:
- Reads temperature and humidity from a virtual DHT22 sensor
- Sends data every 5 minutes (configurable)
- Displays readings in Serial Monitor
- Shows LED blinks on successful upload
- Automatically reconnects if WiFi drops

## 🔧 Customization

### Change Update Interval
```cpp
// Line 15: Update frequency in milliseconds
const unsigned long updateInterval = 300000; // 5 minutes
// Change to 60000 for 1 minute, 30000 for 30 seconds, etc.
```

### Add More Sensors
You can simulate additional sensors:
- Pressure sensor (BMP280)
- Light sensor (LDR)
- Motion sensor (PIR)
- GPS module

### Modify Data Format
Edit the `sendDataToAPI()` function to change what data is sent.

## 🎬 Demo Tips

1. **Live Temperature Changes**:
   - In Wokwi, click the DHT22 sensor
   - Drag the temperature/humidity sliders
   - Watch data update in real-time

2. **Serial Monitor**:
   - Shows all sensor readings
   - Displays API responses
   - Helpful for debugging

3. **LED Indicator**:
   - Blue LED blinks when reading sensor
   - Green LED blinks on successful upload
   - Red LED blinks on error

## 🐛 Troubleshooting

### "WiFi not connected"
- Check if Wokwi-GUEST network is configured
- Restart simulation

### "HTTP Error -1"
- API URL might be wrong
- Check ngrok is running
- Verify CORS settings in backend

### "Failed to read from DHT sensor"
- Circuit connection issue
- Check diagram.json wiring
- Restart simulation

## 📸 Screenshots for Demo

Take screenshots of:
1. Wokwi circuit diagram (hardware)
2. Serial Monitor showing data transmission
3. Your marketplace showing updated data
4. Side-by-side comparison

## 🚀 Advanced: Multiple Devices

Create multiple feeds and run multiple Wokwi tabs:
1. Different locations (SF, Oakland, LA)
2. Different sensor types (temp, air quality, etc.)
3. Different update frequencies

Each tab is an independent IoT device!

---

**Pro Tip**: Keep Wokwi running during your demo presentation. Judges love seeing live hardware simulation!
