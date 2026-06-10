const fs = require('fs');
const os = require('os');
const { join } = require('path');

// Temporary debug log for EDR reduction verification.
// File: <tmpdir>/prey_edr_paths.log
// Remove this module and all edrLog() calls before final release.
const LOG_FILE = join(os.tmpdir(), 'prey_edr_paths.log');

module.exports = (msg) => {
  try {
    fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} [edr] ${msg}\n`);
  } catch { /* never throw — log is best-effort */ }
};
