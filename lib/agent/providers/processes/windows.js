const { getProcessList } = require('../../utils/utilinformation');

/**
  * Callsback an array of processes.
  *
 * */

// NOTE: Not sure if UserModeTime is correct here of if need to add KernelModeTime too.

exports.get_process_list = function (callback) {
  // eslint-disable-next-line consistent-return
  getProcessList((err, out) => {
    if (err) return callback(err);

    callback(null, out.split(/\n/)
      .filter((line) => line.length > 1 && line.indexOf('System Idle Process') === -1)
      .splice(1)
      .map((line) => {
        const fields = line.split(/\s+/);
        const pid = parseInt(fields[2], 10);

        return {
          name: fields[0],
          ppid: parseInt(fields[1], 10),
          pid,
          time: fields[3],
        };
      })
      .filter((obj) => obj !== null));
  });
};
