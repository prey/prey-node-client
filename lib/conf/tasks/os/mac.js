const fs = require('fs');
const { exec } = require('child_process');
const join = require('path').join;
const paths = require(join('..', '..', '..', 'system', 'paths'));
const shared = require(join('..', '..', 'shared'));

const log = (str) => shared.log(str);

exports.post_install = function(cb) {
  cb();
};

exports.pre_uninstall = function(cb) {
  cb();
};

exports.post_activate = function(cb) {
  if (!process.env.UPGRADING_FROM) return cb();

  // During an upgrade, a stale daemon (old version) may already be running.
  // This happens because WatchPaths can restart the daemon between the parent's
  // exit and the activation completing — and at that point 'current' still
  // pointed to the old version. WatchPaths only STARTS a stopped daemon; it
  // does not restart a running one. So when the activation finally updates
  // 'current', the trigger is ignored because the old daemon is already up.
  //
  // Fix: kill any daemon process launched from 'current/bin/' so launchd
  // restarts it from the now-updated 'current' pointing to the new version.
  // This pattern only matches the daemon (launched via current/bin/prey by
  // launchd), not the upgrade child (versions/X/bin/prey) or this activate
  // process (versions/Y/bin/prey).
  log('Checking for stale daemon processes after upgrade...');
  exec('pgrep -f "current/bin/"', function(err, stdout) {
    if (err || !stdout || !stdout.trim()) {
      log('No stale daemon found, triggering WatchPaths for launchd restart...');
      return trigger_watchpaths(cb);
    }

    var pids = stdout.trim().split('\n');
    log('Found stale daemon PIDs: ' + pids.join(', ') + '. Sending SIGTERM...');
    pids.forEach(function(pid) {
      try { process.kill(parseInt(pid.trim()), 'SIGTERM'); } catch(e) {}
    });

    // Give launchd a moment to detect the exit, then trigger WatchPaths
    // to guarantee a restart (covers the case where the daemon exits cleanly
    // with code 0 and KeepAlive would not auto-restart it).
    setTimeout(function() {
      trigger_watchpaths(cb);
    }, 1500);
  });
};

// Creates and removes a marker file in paths.install to trigger WatchPaths.
// This ensures launchd starts the daemon even if KeepAlive did not restart it.
function trigger_watchpaths(cb) {
  var marker = join(paths.install, '.prey_updated');
  fs.writeFile(marker, '', function() {
    fs.unlink(marker, function() {});
    cb();
  });
}

exports.deleteOsquery = (cb) => {
  exec(`${paths.current}/bin/trinity --uninstall`, () => {
    if (cb && typeof cb !== 'undefined') cb();
  });
};