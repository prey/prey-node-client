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
  // WatchPaths only STARTS a stopped daemon; it does not restart a running one.
  // So we must kill the old daemon before triggering WatchPaths.
  //
  // We use `ps` + grep instead of `pgrep -f` because pgrep's sh wrapper
  // contains the search pattern in its own cmdline, causing self-matches.
  // SIGKILL is used instead of SIGTERM because the daemon's SIGTERM handler
  // takes up to 10 seconds for graceful shutdown, during which launchd
  // considers the daemon still alive and ignores WatchPaths triggers.
  log('Checking for stale daemon processes after upgrade...');
  var my_pid = process.pid;
  exec('ps -eo pid,args', function(err, stdout) {
    if (err || !stdout) {
      log('Could not list processes, triggering WatchPaths...');
      return trigger_watchpaths(cb);
    }

    var pids = [];
    stdout.split('\n').forEach(function(line) {
      if (line.indexOf('current/bin/') === -1) return;
      if (line.indexOf('grep') !== -1) return;
      var pid = parseInt(line.trim(), 10);
      if (!pid || pid === my_pid) return;
      pids.push(pid);
    });

    if (!pids.length) {
      log('No stale daemon found, triggering WatchPaths for launchd restart...');
      return trigger_watchpaths(cb);
    }

    log('Found stale daemon PIDs: ' + pids.join(', ') + '. Sending SIGKILL...');
    pids.forEach(function(pid) {
      try { process.kill(pid, 'SIGKILL'); } catch(e) {}
    });

    // Wait until the processes are actually dead before triggering WatchPaths.
    // SIGKILL is immediate but we poll to be sure launchd has noticed the exit.
    wait_for_death(pids, function() {
      trigger_watchpaths(cb);
    });
  });
};

// Polls until all given PIDs are dead, then calls cb.
// Gives up after 15 seconds to avoid blocking activation forever.
function wait_for_death(pids, cb) {
  var elapsed = 0;
  var interval = 500;
  var max_wait = 15000;

  function check() {
    var alive = pids.filter(function(pid) {
      try { process.kill(pid, 0); return true; } catch(e) { return false; }
    });

    if (!alive.length) {
      log('All stale daemon processes have exited.');
      return cb();
    }

    elapsed += interval;
    if (elapsed >= max_wait) {
      log('Timeout waiting for PIDs ' + alive.join(', ') + ' to die. Proceeding...');
      return cb();
    }

    setTimeout(check, interval);
  }

  check();
}

// Creates a marker file in paths.install to trigger WatchPaths.
// The file is kept for 5 seconds so FSEvents reliably detects the change
// (immediate create+delete can be coalesced as "no net change" by macOS).
function trigger_watchpaths(cb) {
  var marker = join(paths.install, '.prey_updated');
  log('Creating WatchPaths marker: ' + marker);
  fs.writeFile(marker, 'upgrade', function() {
    cb();
    // Clean up after FSEvents has had time to detect the file.
    setTimeout(function() {
      fs.unlink(marker, function() {});
    }, 5000);
  });
}

exports.deleteOsquery = (cb) => {
  exec(`${paths.current}/bin/trinity --uninstall`, () => {
    if (cb && typeof cb !== 'undefined') cb();
  });
};