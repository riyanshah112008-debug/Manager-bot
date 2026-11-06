'use strict';

// Backward-compatible entry point for the legacy SWT moderation command path.
// The maintained moderation implementation lives in ./mod.js.
// Re-exporting it avoids maintaining a second, divergent moderation engine.
module.exports = require('./mod');
