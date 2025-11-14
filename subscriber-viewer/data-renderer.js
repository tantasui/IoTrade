/**
 * Data Renderer - Helper script to analyze and render data structures dynamically
 */

class DataRenderer {
    constructor() {
        this.dataStructure = null;
        this.messageCount = 0;
        this.startTime = Date.now();
        this.messageTimestamps = [];
    }

    /**
     * Analyze data structure and create a schema
     */
    analyzeStructure(data) {
        if (!data || typeof data !== 'object') {
            return { type: typeof data, value: String(data) };
        }

        const structure = {};
        
        for (const [key, value] of Object.entries(data)) {
            if (value === null) {
                structure[key] = { type: 'null', value: 'null' };
            } else if (Array.isArray(value)) {
                structure[key] = {
                    type: 'array',
                    length: value.length,
                    itemType: value.length > 0 ? this.getType(value[0]) : 'unknown',
                    sample: value.length > 0 ? value[0] : null
                };
            } else if (typeof value === 'object') {
                structure[key] = {
                    type: 'object',
                    keys: Object.keys(value),
                    nested: this.analyzeStructure(value)
                };
            } else {
                structure[key] = {
                    type: typeof value,
                    value: value,
                    unit: this.detectUnit(key, value)
                };
            }
        }

        return structure;
    }

    /**
     * Get type of a value
     */
    getType(value) {
        if (value === null) return 'null';
        if (Array.isArray(value)) return 'array';
        return typeof value;
    }

    /**
     * Detect unit from key name and value
     */
    detectUnit(key, value) {
        const keyLower = key.toLowerCase();
        
        if (keyLower.includes('temperature') || keyLower.includes('temp')) {
            return value > 100 ? '°F' : '°C';
        }
        if (keyLower.includes('humidity')) return '%';
        if (keyLower.includes('pressure')) return 'hPa';
        if (keyLower.includes('speed') || keyLower.includes('velocity')) return 'mph';
        if (keyLower.includes('timestamp') || keyLower.includes('time')) return 'ms';
        if (keyLower.includes('distance') || keyLower.includes('length')) return 'm';
        if (keyLower.includes('weight') || keyLower.includes('mass')) return 'kg';
        
        return null;
    }

    /**
     * Render data structure as HTML
     */
    renderStructure(structure, level = 0) {
        if (!structure || typeof structure !== 'object') {
            return `<span class="structure-value">${String(structure)}</span>`;
        }

        let html = '<div style="margin-left: ' + (level * 20) + 'px;">';
        
        for (const [key, info] of Object.entries(structure)) {
            html += '<div style="margin-bottom: 8px;">';
            html += `<span class="structure-key">"${key}"</span>: `;
            
            if (info.type === 'object' && info.nested) {
                html += '<span class="structure-type">object</span> {';
                html += '<div style="margin-left: 20px;">';
                html += this.renderStructure(info.nested, level + 1);
                html += '</div>';
                html += '}';
            } else if (info.type === 'array') {
                html += `<span class="structure-type">array[${info.length}]</span> of <span class="structure-type">${info.itemType}</span>`;
                if (info.sample) {
                    html += '<div style="margin-left: 20px; color: #6b7280;">';
                    html += `Sample: ${JSON.stringify(info.sample)}`;
                    html += '</div>';
                }
            } else {
                html += `<span class="structure-type">${info.type}</span>`;
                if (info.value !== undefined) {
                    const valueType = typeof info.value;
                    let valueClass = 'structure-value';
                    if (valueType === 'string') valueClass = 'structure-string';
                    else if (valueType === 'number') valueClass = 'structure-number';
                    else if (valueType === 'boolean') valueClass = 'structure-boolean';
                    html += ` = <span class="${valueClass}">${JSON.stringify(info.value)}</span>`;
                }
                if (info.unit) {
                    html += ` <span style="color: #6b7280;">(${info.unit})</span>`;
                }
            }
            
            html += '</div>';
        }
        
        html += '</div>';
        return html;
    }

    /**
     * Render data item as HTML card
     */
    renderDataItem(data, timestamp, index) {
        const date = new Date(timestamp);
        const formattedTime = date.toLocaleTimeString();
        const formattedDate = date.toLocaleDateString();

        let html = '<div class="data-item new" id="data-item-' + index + '">';
        html += '<div class="data-header">';
        html += '<div>';
        html += '<div class="data-timestamp">' + formattedDate + ' ' + formattedTime + '</div>';
        html += '</div>';
        html += '<div class="data-number">#' + index + '</div>';
        html += '</div>';
        html += '<div class="data-content">';
        html += this.formatData(data);
        html += '</div>';
        html += '</div>';

        // Remove 'new' class after animation
        setTimeout(() => {
            const element = document.getElementById('data-item-' + index);
            if (element) {
                element.classList.remove('new');
            }
        }, 300);

        return html;
    }

    /**
     * Format data for display with terminal-themed syntax highlighting
     */
    formatData(data, indent = 0) {
        if (data === null) {
            return '<span style="color: #6b7280;">null</span>';
        }

        if (typeof data === 'string') {
            return '<span class="structure-string">"' + this.escapeHtml(data) + '"</span>';
        }

        if (typeof data === 'number') {
            return '<span class="structure-number">' + data + '</span>';
        }

        if (typeof data === 'boolean') {
            return '<span class="structure-boolean">' + data + '</span>';
        }

        if (Array.isArray(data)) {
            let html = '<span style="color: #6b7280;">[</span><br>';
            data.forEach((item, i) => {
                html += '&nbsp;'.repeat((indent + 1) * 2);
                html += this.formatData(item, indent + 1);
                if (i < data.length - 1) html += ',';
                html += '<br>';
            });
            html += '&nbsp;'.repeat(indent * 2) + '<span style="color: #6b7280;">]</span>';
            return html;
        }

        if (typeof data === 'object') {
            let html = '<span style="color: #6b7280;">{</span><br>';
            const entries = Object.entries(data);
            entries.forEach(([key, value], i) => {
                html += '&nbsp;'.repeat((indent + 1) * 2);
                html += '<span class="structure-key">"' + this.escapeHtml(key) + '"</span>: ';
                html += this.formatData(value, indent + 1);
                if (i < entries.length - 1) html += ',';
                html += '<br>';
            });
            html += '&nbsp;'.repeat(indent * 2) + '<span style="color: #6b7280;">}</span>';
            return html;
        }

        return String(data);
    }

    /**
     * Escape HTML special characters
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Update statistics
     */
    updateStats() {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        
        // Filter messages from last minute
        this.messageTimestamps = this.messageTimestamps.filter(ts => ts > oneMinuteAgo);
        
        document.getElementById('totalMessages').textContent = this.messageCount;
        document.getElementById('messagesPerMin').textContent = this.messageTimestamps.length;
        
        if (this.messageTimestamps.length > 0) {
            const lastUpdate = new Date(this.messageTimestamps[this.messageTimestamps.length - 1]);
            const secondsAgo = Math.floor((now - lastUpdate.getTime()) / 1000);
            document.getElementById('lastUpdate').textContent = secondsAgo + 's ago';
        }
    }
}

// Export for use in other scripts
window.DataRenderer = DataRenderer;


