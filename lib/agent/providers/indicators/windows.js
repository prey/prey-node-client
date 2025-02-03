/* eslint-disable consistent-return */
const { battery, getRemainingStorage } = require('../../utils/utilinformation');

/**
 *
 * */
exports.get_remaining_storage = (cb) => {
  getRemainingStorage((err, stdout) => {
    if (err) return cb(err);
    const cols = stdout.trim().split('\n');
    const totalGb = cols[0].replace('\r', '').split(':')[1].trim();

    const freeGb = cols[1].replace('\r', '').split(':')[1].trim();
    const info = {
      total_gb: totalGb,
      free_gb: freeGb,
      used: (totalGb / freeGb) * 100,
    };

    cb(null, info);
  });
};

/**
 *
 * */
exports.get_battery_status = (cb) => {
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

  battery((memory) => {
    const data = {
      percentage_remaining: parseInt(memory.percent, 10),
      state: getStateBattery(memory),
      time_remaining: memory.timeRemaining || 'unknown',
    };
    cb(null, data);
  });
};
