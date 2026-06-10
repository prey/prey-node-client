var exec = require('child_process').exec;
var winsvc = require('./winsvc');
var edrLog = require('./edr_log');

var FIREWALL_MIN_WINSVC_VERSION = '2.0.33';

exports.get = function(path, key, cb){
  var cmd = 'reg query ' + path + ' /v ' + key;

  exec(cmd, { timeout: 5000 }, function(err, stdout) {
    if (err) return cb(err);

    var match = stdout.toString().match(/REG_SZ\s+(.+)/);

    if (match)
      cb(null, match[1]);
    else
      cb(new Error('Unable to find key ' + key + ' in ' + path))

  });
}

exports.set = function(path, key, val, cb){
  winsvc.supports(FIREWALL_MIN_WINSVC_VERSION, function(supported) {
    if (!supported) {
      edrLog('registry.set: winsvc not supported — using reg.exe fallback path=' + path + ' key=' + key);
      return exec('reg add ' + path + ' /v ' + key + ' /d ' + val + ' /f', { timeout: 5000 }, cb);
    }
    edrLog('registry.set: using winsvc HTTP path=' + path + ' key=' + key);
    winsvc.http_action('registry-set-value', { path: path, key: key, value: val }, function(err) {
      if (err) { edrLog('registry.set: HTTP failed (' + err.message + ') — reg.exe fallback'); return exec('reg add ' + path + ' /v ' + key + ' /d ' + val + ' /f', { timeout: 5000 }, cb); }
      edrLog('registry.set: set via winsvc HTTP OK');
      cb(null);
    });
  });
}

exports.del = function(path, key, cb){
  winsvc.supports(FIREWALL_MIN_WINSVC_VERSION, function(supported) {
    if (!supported) {
      edrLog('registry.del: winsvc not supported — using reg.exe fallback path=' + path + ' key=' + key);
      return exec('reg delete ' + path + ' /v ' + key + ' /f', { timeout: 5000 }, function(err){
        cb(); // don't mind if it does not exist.
      });
    }
    edrLog('registry.del: using winsvc HTTP path=' + path + ' key=' + key);
    winsvc.http_action('registry-delete-value', { path: path, key: key }, function(err) {
      if (err) {
        edrLog('registry.del: HTTP failed (' + err.message + ') — reg.exe fallback');
        return exec('reg delete ' + path + ' /v ' + key + ' /f', { timeout: 5000 }, function(){
          cb();
        });
      }
      edrLog('registry.del: deleted via winsvc HTTP OK');
      cb(null);
    });
  });
}
