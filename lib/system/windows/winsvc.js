const { exec } = require('child_process');
const http = require('http');
const fs = require('fs');
const { join } = require('path');
const compareVersions = require('compare-versions');
const paths = require('../paths');

const WINSVC_PORT = 7739;

const get_bin = () => {
  const installed = join(paths.install, 'wpxsvc.exe');
  const bundled = join(paths.current, 'lib', 'system', 'windows', 'bin', 'wpxsvc.exe');
  return fs.existsSync(installed) ? installed : bundled;
};

let version_cache;

const get_version = (cb) => {
  if (version_cache) return cb(null, version_cache);
  return exec(`"${get_bin()}" -winsvc=version`, (err, stdout) => {
    if (!err && stdout) version_cache = stdout.split('\n')[0].trim();
    return cb(null, version_cache || null);
  });
};

const supports = (minVersion, cb) => {
  get_version((_, v) => cb(Boolean(v && compareVersions(v, minVersion) >= 0)));
};

const http_action = (action, opts, cb) => {
  const body = JSON.stringify({ action, opts });
  const req = http.request(
    {
      host: '127.0.0.1',
      port: WINSVC_PORT,
      path: '/action',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    },
    (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          // winsvc Go structs use capitalized field names (no json tags): Error, Message
          if (result.Error) return cb(new Error(result.Message || 'winsvc action failed'));
        } catch { /* treat parse error as success */ }
        return cb(null);
      });
    },
  );
  req.setTimeout(2000, () => { req.destroy(new Error('timeout')); });
  req.on('error', cb);
  req.write(body);
  req.end();
};

module.exports = {
  get_bin,
  get_version,
  supports,
  http_action,
};
