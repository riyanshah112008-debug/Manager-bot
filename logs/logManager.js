const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'logConfig.json');

function getConfig() {
    // If file doesn't exist, create it with empty braces
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify({}));
    }
    
    let data = fs.readFileSync(configPath, 'utf8').trim();
    
    // FIX: If the file exists but is completely empty, default to '{}' to prevent crashing
    if (!data) {
        data = '{}';
        fs.writeFileSync(configPath, data);
    }
    
    try {
        return JSON.parse(data);
    } catch (e) {
        // If JSON is corrupted, reset it safely
        fs.writeFileSync(configPath, JSON.stringify({}));
        return {};
    }
}

function saveConfig(config) {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
}

module.exports = { getConfig, saveConfig };