# Data Feed Subscriber Viewer

## ✨ Option 1: Pre-Authorized Session Keys

**This viewer now supports seamless decryption without wallet connection!**

When you subscribe via the React frontend, a session key is automatically stored server-side. When you connect with just your API key, the backend automatically retrieves the stored session key and decrypts data for you.

**No wallet required** - just your API key! 🎉

See [OPTION1_IMPLEMENTATION.md](./OPTION1_IMPLEMENTATION.md) for details.

---

# Data Feed Subscriber Viewer

A real-time WebSocket client for monitoring data feeds from the Data Marketplace.

## Features

- 🔌 **WebSocket Connection** - Real-time data streaming
- 📊 **Live Data Display** - See data updates as they arrive
- 🔍 **Dynamic Structure Analysis** - Automatically detects and displays data structure
- 📈 **Statistics** - Track message count, rate, and last update time
- 🎨 **Modern UI** - Clean, responsive interface

## Setup

1. **Open `index.html`** in a web browser
   - You can use a local file server or open directly
   - For best results, use a local server: `python -m http.server 8000` or `npx serve`

2. **Configure Connection**
   - **WebSocket URL**: Your backend WebSocket endpoint (default: `ws://localhost:3001/ws`)
   - **Feed ID**: The feed ID you want to subscribe to (pre-filled with your feed)
   - **Subscriber API Key**: Your `sk_xxx` subscriber API key

3. **Click "Connect"** to start receiving data

## Getting Your Subscriber API Key

1. Go to the Subscriber Dashboard in the frontend
2. Subscribe to a feed if you haven't already
3. Open the subscription details
4. Create a subscriber API key in the API Key Manager
5. Copy the `sk_xxx` key (it's only shown once!)

## Usage

- **Connect**: Establishes WebSocket connection and subscribes to the feed
- **Disconnect**: Closes the connection
- **Clear Data**: Removes all displayed data (doesn't disconnect)

## Data Display

- **Live Data Stream**: Shows incoming data messages in real-time
- **Data Structure**: Automatically analyzes and displays the structure of your data
- **Statistics**: 
  - Total messages received
  - Messages per minute
  - Time since last update

## Files

- `index.html` - Main HTML page with UI
- `websocket-client.js` - WebSocket connection and message handling
- `data-renderer.js` - Data structure analysis and rendering

## Notes

- The feed ID is pre-configured to: `0xdecee9d21c031b9253a0e96b819729e5684cacd6620a0b6346e22621553d2936`
- Make sure your backend WebSocket server is running on `localhost:3001`
- The WebSocket URL defaults to `ws://localhost:3001/ws` for local development
- For production, change it to `wss://your-backend-domain.com/ws`
- Data is limited to the last 50 messages to prevent memory issues


