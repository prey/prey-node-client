var exec = require('child_process').exec;

exports.by_name = function(process_name, cb) {
  exec('taskkill /f /im ' + process_name, cb);
}

exports.by_pid  = function(pid, cb) {
  exec('taskkill /f /pid ' + pid, cb);
}
