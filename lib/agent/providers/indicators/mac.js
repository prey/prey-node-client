// @ts-check
const { exec } = require('child_process');

/**
 * Reads battery status. When battery is charging, time remaining is actually
 * what remains until the battery is full. This platform has no TTL cache, so any
 * options object (e.g. { bypassCache: true }) is accepted and ignored; it exists
 * only to keep a uniform (options, cb) / (cb) contract with providers.get.
 * @param {{ bypassCache?: boolean } | ((err: Error|null, data?: object) => void)} optsOrCb
 * @param {(err: Error|null, data?: object) => void} [maybeCb]
 */
exports.get_battery_status = function (optsOrCb, maybeCb) {
  const callback = typeof optsOrCb === 'function' ? optsOrCb : maybeCb;
  if (typeof callback !== 'function') return;
  exec('pmset -g batt', { timeout: 8000 }, (err, stdout) => {
    if (err) return callback(err);

    let time_remaining; const
      output = stdout.toString();

    try {
      var percentage_remaining = output.match(/(\d+)%;/)[1];
      var state = output.match(/%;\s+(\w+)/)[1];
    } catch (err) {
      return callback(new Error('No battery found.'));
    }

    // when plugged, for a second the status is 'AC attached, not charging'
    if (state == 'AC') state = 'charging';

    const time_value = output.match(/;\s+(\d+:\d+)/);
    if (time_value) time_remaining = time_value[1];

    const data = {
      percentage_remaining,
      time_remaining,
      state,
    };

    callback(null, data);
  });
};

exports.get_remaining_storage = function (callback) {
  exec('df -kh / | tail -1', { timeout: 8000 }, (err, stdout) => {
    if (err) return callback(err);

    const data = stdout.toString().trim().split(/\s+/);

    const info = {
      total_gb: data[1],
      free_gb: data[3],
      used: data[4],
    };

    callback(null, info);
  });
};
