// @ts-check
/* eslint-disable consistent-return */
const { battery, getRemainingStorage } = require('../../utils/utilinformation');

// TTL cache for battery status. The underlying systeminformation.battery() call
// spawns 3 powershell.exe processes on Windows (two of them query STATIC design
// capacities that never change), and Windows Defender scans each spawn. Battery
// level changes slowly, so a short cache collapses bursty callers to ~1 refresh
// per minute without meaningfully affecting freshness. Successful results only.
const BATTERY_TTL_MS = 60000;
let batteryCache = { value: /** @type {object|null} */ (null), expires: 0 };

/**
 * @param {{ isCharging: boolean, percent: number }} batteryData
 * @returns {string|undefined}
 */
const getStateBattery = (batteryData) => {
  if (batteryData.isCharging) {
    return 'charging';
  }
  if (!batteryData.isCharging && batteryData.percent < 100) {
    return 'discharging';
  }
  if (batteryData.percent === 100) {
    return 'charged';
  }
};

/**
 * @param {(err: Error|null, info?: object) => void} cb
 */
exports.get_remaining_storage = (cb) => {
  getRemainingStorage((err, stdout) => {
    if (err) return cb(err);
    const cols = stdout.trim().split('\n');
    const totalGb = cols[0].replace('\r', '').split(':')[1].trim();

    const freeGb = cols[1].replace('\r', '').split(':')[1].trim();
    const info = {
      total_gb: totalGb,
      free_gb: freeGb,
      used: ((Number(totalGb) - Number(freeGb)) / Number(totalGb)) * 100,
    };

    cb(null, info);
  });
};

/**
 * Reads battery status, served from a short TTL cache to collapse bursty callers.
 * Event-driven callers that need a guaranteed-fresh reading (e.g. the power
 * trigger detecting charger plug/unplug) pass { bypassCache: true } to skip the
 * cache read; a fresh read still refreshes the cache for subsequent callers.
 * @param {{ bypassCache?: boolean } | ((err: Error|null, data?: object) => void)} optsOrCb
 * @param {(err: Error|null, data?: object) => void} [maybeCb]
 */
exports.get_battery_status = (optsOrCb, maybeCb) => {
  const cb = typeof optsOrCb === 'function' ? optsOrCb : maybeCb;
  const opts = typeof optsOrCb === 'function' ? {} : (optsOrCb || {});
  const now = Date.now();
  if (!opts.bypassCache && batteryCache.value && batteryCache.expires > now) {
    return typeof cb === 'function' && cb(null, batteryCache.value);
  }

  battery((memory) => {
    const data = {
      percentage_remaining: parseInt(memory.percent, 10),
      state: getStateBattery(memory),
      time_remaining: memory.timeRemaining || 'unknown',
    };
    batteryCache = { value: data, expires: Date.now() + BATTERY_TTL_MS };
    return typeof cb === 'function' && cb(null, data);
  });
};
