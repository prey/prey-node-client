const fs = require('fs');

exports.remove = (pidFile, cb) => {
  fs.unlink(pidFile, (err) => {
    if (typeof cb !== 'function') return;
    cb(err);
  });
};

// eslint-disable-next-line consistent-return
exports.checkPidPermissions = (pid, cb) => {
  try {
    process.kill(pid, 0);
    cb(null);
  } catch (e) {
    if (e.code === 'EPERM') {
      if (typeof cb === 'function') return cb(null);
    }
    if (typeof cb === 'function') cb(e); // probaby e.code == 'ESRCH', not really running
  }
};

exports.readFileRaw = (file, cb) => {
  // eslint-disable-next-line consistent-return
  fs.readFile(file, (errRead, str) => {
    if (errRead) return cb(errRead);
    cb(null, str);
  });
};

exports.parsePid = (str, cb) => {
  const pid = parseInt(str, 10);
  cb(null, pid);
};

exports.readFile = (file, cb) => {
  // eslint-disable-next-line consistent-return
  exports.readFileRaw(file, (err, str) => {
    if (err) return cb(err);
    // eslint-disable-next-line consistent-return
    exports.parsePid(str, (errParse, pid) => {
      if (errParse) return cb(errParse);
      cb(null, pid);
    });
  });
};

exports.statFile = (file, cb) => {
  // eslint-disable-next-line consistent-return
  fs.stat(file, (err, stat) => {
    if (err) return cb(err);

    cb(null, stat);
  });
};

exports.read = (file, cb) => {
  // eslint-disable-next-line consistent-return
  exports.statFile(file, (errStat, stat) => {
    if (errStat) return cb(errStat);

    // eslint-disable-next-line consistent-return
    exports.readFile(file, (errRead, pid) => {
      if (errRead) return cb(errRead);

      const obj = { stat, pid };

      // eslint-disable-next-line consistent-return
      exports.checkPidPermissions(pid, (errPerm) => {
        if (errPerm) return cb(errPerm);

        cb(null, obj);
      });
    });
  });
};

exports.store = (file, callback) => {
  // eslint-disable-next-line consistent-return
  exports.read(file, (err, running) => {
    if (running) return callback(err, running);
    // if all was good, then callback(err) will be null
    fs.writeFile(file, process.pid.toString(), callback);
  });
};
