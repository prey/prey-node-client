var shared = require('./shared'),
    log    = shared.log;

exports.current = function(values, cb) {
  var curr = shared.version_manager.current();
  if (curr) log(curr);
}

exports.this = function(values, cb) {
  var ver = shared.version_manager.this();
  if (ver) log(ver);
}

exports.list = function(values, cb) {
  var list = shared.version_manager.list();
  if (list) log(list.join('\n'));
};

exports.set = function(values, cb) {
  var version = values.version;
  if (!version) return cb(new Error('Version not passed.'));

  shared.version_manager.set_current(version, cb);
}