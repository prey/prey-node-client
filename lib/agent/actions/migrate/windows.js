// @ts-check
const { execFile } = require('child_process');
const { join } = require('path');
const winsvc = require('../../../system/windows/winsvc');

// winsvc 2.0.37 is the first with migrate / migrate-status.
const MIN_WINSVC_VERSION = '2.0.37';
const SUBMIT_TIMEOUT_MS = 240000;
const STATUS_TIMEOUT_MS = 60000;

/** @param {(err: (Error|null), result?: any) => void} cb */
const unwrap = (cb) => (err, envelope) => {
  if (err) return cb(err);
  if (!envelope || envelope.error || typeof envelope.output !== 'object' || envelope.output === null) {
    return cb(new Error('service_error'));
  }
  return cb(null, envelope.output);
};

exports.checkService = (cb) => winsvc.supports(MIN_WINSVC_VERSION, (ok) => cb(ok ? null : 'winsvc_too_old'));
exports.submit = (cb) => winsvc.request_action('migrate', SUBMIT_TIMEOUT_MS, unwrap(cb));
exports.status = (cb) => winsvc.request_action('migrate-status', STATUS_TIMEOUT_MS, unwrap(cb));
// goprey registers the remsvc service (goprey common/names.go).
exports.gopreyInstalled = (cb) => {
  const sc = join(process.env.SystemRoot || String.raw`C:\Windows`, 'System32', 'sc.exe');
  execFile(sc, ['query', 'remsvc'], { timeout: 10000 }, (err) => cb(!err));
};
