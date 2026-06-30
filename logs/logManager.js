const fs = require('fs');
const path = require('path');

// __dirname dynamically grabs the current folder (your Logs folder)
const configPath = path.join(__dirname, 'logConfig.json');

// Read the current configuration
function getConfig() {
    // If the file doesn't exist yet, create a blank one automatically
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify({}));
    }
    
    // Read and parse the JSON data
    const data = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(data);
}

// Save updates to the configuration
function saveConfig(config) {
    // The 'null, 4' arguments format the JSON to be readable with 4 spaces of indentation
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
}

// Export the functions so your other files can use them
module.exports = { getConfig, saveConfig };
