// @ts-check
const { execFile } = require('child_process');
const compareVersions = require('compare-versions');
const socket = require('../../socket');
const macSystem = require('../../../system/mac');

// macsvc (prey-user) 1.1.0 is the first with the migrate action.
const MIN_MACSVC_VERSION = '1.1.0';
// macsvc copies prey-recovery and verifies it with codesign (30 s) before its
// migrate (215 s) and status (50 s) subprocess budgets.
const SUBMIT_TIMEOUT_MS = 270000;
const STATUS_TIMEOUT_MS = 90000;

// rewire replaces this in tests.
const getPreyUserVersion = macSystem.get_prey_user_version;

/** @param {(err: (Error|null), result?: any) => void} cb */
const unwrap = (cb) => (err, response) => {
  if (err) return cb(err);
  const result = response && response.success && response.output ? response.output.result : null;
  if (typeof result !== 'object' || result === null) return cb(new Error('service_error'));
  return cb(null, result);
};

// get_prey_user_version calls back inside a try and again from its catch, so a
// throw downstream would re-enter: call back once, outside that try.
exports.checkService = (cb) => {
  let called = false;
  getPreyUserVersion((err, version) => {
    if (called) return;
    called = true;
    const ok = !err && version && compareVersions(version, MIN_MACSVC_VERSION) >= 0;
    setImmediate(() => cb(ok ? null : 'macsvc_too_old'));
  });
};
exports.submit = (cb) => socket.request('migrate-migrate', SUBMIT_TIMEOUT_MS, unwrap(cb));
exports.status = (cb) => socket.request('migrate-status', STATUS_TIMEOUT_MS, unwrap(cb));
// The goprey pkg receipt id is frozen (goprey common.DarwinPkgIdentifier).
exports.gopreyInstalled = (cb) => execFile('/usr/sbin/pkgutil', ['--pkg-info', 'com.preyhq.prey.agent'], { timeout: 10000 }, (err) => cb(!err));
