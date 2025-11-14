/**
 * WebSocket Client - Handles connection and data streaming
 */

let ws = null;
let renderer = null;
let isConnected = false;
let dataIndex = 0;

/**
 * Initialize renderer
 */
function initRenderer() {
    if (!renderer) {
        renderer = new DataRenderer();
    }
}

/**
 * Update connection status UI
 */
function updateStatus(status, text) {
    const indicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const connectBtn = document.getElementById('connectBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');

    indicator.className = 'status-indicator ' + status;
    statusText.textContent = text;

    if (status === 'connected') {
        connectBtn.disabled = true;
        disconnectBtn.disabled = false;
    } else {
        connectBtn.disabled = false;
        disconnectBtn.disabled = true;
    }
}

/**
 * Show error message
 */
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = '❌ ' + message;
    errorDiv.style.display = 'block';
    
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

/**
 * Hide error message
 */
function hideError() {
    document.getElementById('errorMessage').style.display = 'none';
}

/**
 * Connect to WebSocket
 */
function connect() {
    const wsUrl = document.getElementById('wsUrl').value.trim();
    const feedId = document.getElementById('feedId').value.trim();
    const apiKey = document.getElementById('apiKey').value.trim();

    if (!wsUrl) {
        showError('WebSocket URL is required');
        return;
    }

    if (!feedId) {
        showError('Feed ID is required');
        return;
    }

    if (!apiKey) {
        showError('Subscriber API Key is required');
        return;
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
        showError('Already connected');
        return;
    }

    initRenderer();
    hideError();
    updateStatus('connecting', 'Connecting...');

    try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('✅ WebSocket connected');
            isConnected = true;
            updateStatus('connected', 'Connecting...');

            // Subscribe to feed
            const subscribeMessage = {
                type: 'subscribe',
                feedId: feedId,
                apiKey: apiKey
            };

            console.log('📤 Subscribing to feed:', subscribeMessage);
            try {
                ws.send(JSON.stringify(subscribeMessage));
                console.log('✅ Subscribe message sent');
            } catch (error) {
                console.error('❌ Failed to send subscribe message:', error);
                showError('Failed to send subscription request');
            }
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                console.log('📨 Received WebSocket message:', message);
                handleMessage(message);
            } catch (error) {
                console.error('Error parsing message:', error);
                showError('Failed to parse message: ' + error.message);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            showError('WebSocket connection error. Check console for details.');
            updateStatus('disconnected', 'Connection Error');
        };

        ws.onclose = (event) => {
            console.log('WebSocket closed:', event.code, event.reason);
            isConnected = false;
            updateStatus('disconnected', 'Disconnected');
            
            if (event.code !== 1000) {
                showError('Connection closed unexpectedly');
            }
        };

    } catch (error) {
        console.error('Failed to create WebSocket:', error);
        showError('Failed to connect: ' + error.message);
        updateStatus('disconnected', 'Connection Failed');
    }
}

/**
 * Handle incoming WebSocket messages
 */
function handleMessage(message) {
    console.log('Received message:', message);

    switch (message.type) {
        case 'subscribed':
            console.log('Successfully subscribed to feed:', message.feedId);
            updateStatus('connected', 'Connected & Subscribed');
            hideError();
            break;

        case 'data':
            handleDataMessage(message);
            break;

        case 'error':
            console.error('WebSocket error:', message.error);
            showError(message.error || 'Unknown error');
            break;

        case 'unsubscribed':
            console.log('Unsubscribed from feed');
            break;

        default:
            console.log('Unknown message type:', message);
    }
}

/**
 * Handle data message
 */
function handleDataMessage(message) {
    if (!message.data) {
        console.warn('Message has no data:', message);
        return;
    }

    dataIndex++;
    renderer.messageCount = dataIndex;
    renderer.messageTimestamps.push(message.timestamp || Date.now());

    // Update data structure if first message or structure changed
    if (!renderer.dataStructure) {
        renderer.dataStructure = renderer.analyzeStructure(message.data);
        updateDataStructure();
    }

    // Add data item to list
    addDataItem(message.data, message.timestamp || Date.now(), dataIndex);

    // Update statistics
    renderer.updateStats();
}

/**
 * Update data structure display
 */
function updateDataStructure() {
    const structureDiv = document.getElementById('dataStructure');
    
    if (!renderer.dataStructure) {
        structureDiv.innerHTML = '<div class="empty-state"><p>No data structure available</p></div>';
        return;
    }

    structureDiv.innerHTML = renderer.renderStructure(renderer.dataStructure);
}

/**
 * Add data item to the list
 */
function addDataItem(data, timestamp, index) {
    const dataList = document.getElementById('dataList');
    
    // Remove empty state if present
    const emptyState = dataList.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }

    // Create new data item
    const itemHtml = renderer.renderDataItem(data, timestamp, index);
    
    // Insert at the top
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = itemHtml;
    dataList.insertBefore(tempDiv.firstElementChild, dataList.firstChild);

    // Limit to 50 items
    const items = dataList.querySelectorAll('.data-item');
    if (items.length > 50) {
        items[items.length - 1].remove();
    }
}

/**
 * Disconnect from WebSocket
 */
function disconnect() {
    if (ws) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'unsubscribe' }));
        }
        ws.close();
        ws = null;
    }
    isConnected = false;
    updateStatus('disconnected', 'Disconnected');
}

/**
 * Clear all data
 */
function clearData() {
    if (confirm('Are you sure you want to clear all data?')) {
        const dataList = document.getElementById('dataList');
        dataList.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg><p>No data received yet. Connect to start receiving updates.</p></div>';
        
        const structureDiv = document.getElementById('dataStructure');
        structureDiv.innerHTML = '<div class="empty-state"><p>Data structure will appear here after first message</p></div>';
        
        if (renderer) {
            renderer.dataStructure = null;
            renderer.messageCount = 0;
            renderer.messageTimestamps = [];
        }
        
        dataIndex = 0;
        document.getElementById('totalMessages').textContent = '0';
        document.getElementById('messagesPerMin').textContent = '0';
        document.getElementById('lastUpdate').textContent = '--';
    }
}

// Update stats every second
setInterval(() => {
    if (renderer) {
        renderer.updateStats();
    }
}, 1000);

// Handle page unload
window.addEventListener('beforeunload', () => {
    disconnect();
});

// Allow Enter key to connect
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !isConnected) {
        connect();
    }
});

