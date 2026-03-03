const fs = require('fs');
const { exec } = require('child_process');
const join = require('path').join;
const paths = require(join('..', '..', '..', 'system', 'paths'));
const shared = require(join('..', '..', 'shared'));

const log = (str) => shared.log(str);

var debug_log_path = '/tmp/prey_upgrade_debug.log';
function debug_log(msg) {
  try {
    var now = new Date();
    var ts = now.toISOString().replace('T', ' ').replace('Z', '');
    fs.appendFileSync(debug_log_path, '[' + ts + '] [mac] ' + msg + '\n');
  } catch(e) {}
}

exports.post_install = function(cb) {
  cb();
};

exports.pre_uninstall = function(cb) {
  cb();
};

// ───────────────────────────────────────────────────────────────────────
// post_activate: ensure the daemon restarts with the new version
//
// Problem: set_current's atomic rename triggers WatchPaths, but the daemon
// can't start while 'current' is briefly missing (between the two renames).
// This failed start puts launchd into ThrottleInterval (10s default).
// Any WatchPaths trigger during the throttle is ignored.
//
// Solution:
//   1. Kill any stale daemon immediately (search both current/bin/ and
//      versions/{old}/bin/ to catch symlink-resolved paths).
//   2. Wait 15 seconds for ThrottleInterval to expire.
//   3. Kill again (daemon may have been restarted during the wait).
//   4. Trigger WatchPaths — now guaranteed to be processed.
//
// Budget: run_synced gives us 60s total for activation. Steps 1-4 of
// set_current + chmodr + codesign + client.put take ~10-20s, leaving
// ~40s for post_activate. We use at most ~20s.
// ───────────────────────────────────────────────────────────────────────
exports.post_activate = function(cb) {
  debug_log('post_activate() called');
  debug_log('  UPGRADING_FROM=' + (process.env.UPGRADING_FROM || '(not set)'));
  debug_log('  process.pid=' + process.pid);
  debug_log('  paths.install=' + paths.install);

  if (!process.env.UPGRADING_FROM) {
    debug_log('  No UPGRADING_FROM, returning early');
    return cb();
  }

  var old_version = process.env.UPGRADING_FROM;
  var my_pid = process.pid;

  log('Upgrade from ' + old_version + '. Ensuring daemon runs new version...');

  // Step 1: Kill any stale daemon immediately
  debug_log('  Step 1: find_and_kill START (first pass)');
  find_and_kill(old_version, my_pid, function() {
    debug_log('  Step 1: find_and_kill DONE');

    // Step 2: Wait for launchd ThrottleInterval to expire.
    // set_current's rename triggers a failed WatchPaths start (current briefly
    // missing), which puts launchd into a 10s throttle. We must wait it out
    // or our WatchPaths trigger gets silently ignored.
    log('Waiting 15s for launchd ThrottleInterval to expire...');
    debug_log('  Step 2: setTimeout(15000) START at ' + new Date().toISOString());
    setTimeout(function() {
      debug_log('  Step 2: setTimeout(15000) FIRED at ' + new Date().toISOString());

      // Step 3: Kill again — a stale daemon may have been restarted by
      // KeepAlive or a queued WatchPaths event during the wait.
      debug_log('  Step 3: find_and_kill START (second pass)');
      find_and_kill(old_version, my_pid, function() {
        debug_log('  Step 3: find_and_kill DONE');

        // Step 4: Trigger WatchPaths. Throttle has expired so launchd
        // will process this and start the daemon from the updated 'current'.
        log('ThrottleInterval expired. Triggering WatchPaths...');
        debug_log('  Step 4: trigger_watchpaths START');
        trigger_watchpaths(function() {
          debug_log('  Step 4: trigger_watchpaths DONE. post_activate complete.');
          cb();
        });
      });
    }, 15000);
  });
};

// Finds daemon processes by matching against both the logical path
// (current/bin/) and the resolved symlink path (versions/{old}/bin/).
// pgrep is avoided because its sh wrapper self-matches.
function find_and_kill(old_version, my_pid, cb) {
  debug_log('  find_and_kill(): old_version=' + old_version + ', my_pid=' + my_pid);
  exec('ps -eo pid,args', function(err, stdout) {
    if (err || !stdout) {
      log('Could not list processes.');
      debug_log('  find_and_kill(): ps command failed: ' + (err ? err.message : 'no stdout'));
      return cb();
    }

    debug_log('  find_and_kill(): ps output START >>>');
    debug_log(stdout);
    debug_log('  find_and_kill(): ps output END <<<');

    var patterns = ['current/bin/'];
    if (old_version) patterns.push('versions/' + old_version + '/bin/');
    debug_log('  find_and_kill(): patterns=' + JSON.stringify(patterns));

    var pids = [];
    stdout.split('\n').forEach(function(line) {
      var dominated = patterns.some(function(p) { return line.indexOf(p) !== -1; });
      if (!dominated) return;
      if (line.indexOf('grep') !== -1) return;
      var pid = parseInt(line.trim(), 10);
      if (!pid || pid === my_pid) return;
      pids.push(pid);
    });

    debug_log('  find_and_kill(): matched PIDs=' + JSON.stringify(pids));

    if (!pids.length) {
      log('No stale daemon found.');
      debug_log('  find_and_kill(): no stale daemons found');
      return cb();
    }

    log('Killing daemon PIDs: ' + pids.join(', '));
    pids.forEach(function(pid) {
      try {
        process.kill(pid, 'SIGKILL');
        debug_log('  find_and_kill(): killed PID ' + pid + ' OK');
      } catch(e) {
        debug_log('  find_and_kill(): kill PID ' + pid + ' failed: ' + e.message);
      }
    });

    wait_for_death(pids, cb);
  });
}

// Polls until all PIDs are dead. Gives up after 10s.
function wait_for_death(pids, cb) {
  var elapsed = 0;
  var interval = 500;
  var max_wait = 10000;
  debug_log('  wait_for_death(): watching PIDs=' + JSON.stringify(pids));

  function check() {
    var alive = pids.filter(function(pid) {
      try { process.kill(pid, 0); return true; } catch(e) { return false; }
    });
    debug_log('  wait_for_death(): elapsed=' + elapsed + 'ms, alive=' + JSON.stringify(alive));
    if (!alive.length) {
      log('All daemon processes have exited.');
      debug_log('  wait_for_death(): all dead');
      return cb();
    }
    elapsed += interval;
    if (elapsed >= max_wait) {
      log('Timeout waiting for PIDs to die. Proceeding.');
      debug_log('  wait_for_death(): TIMEOUT after ' + elapsed + 'ms, still alive=' + JSON.stringify(alive));
      return cb();
    }
    setTimeout(check, interval);
  }
  check();
}

// Creates a marker file to trigger WatchPaths. The file is kept for 10s
// so it persists well beyond any ThrottleInterval edge case.
function trigger_watchpaths(cb) {
  var marker = join(paths.install, '.prey_updated');
  log('Creating WatchPaths marker: ' + marker);
  debug_log('  trigger_watchpaths(): creating marker at ' + marker);
  fs.writeFile(marker, 'upgrade-' + Date.now(), function(err) {
    debug_log('  trigger_watchpaths(): marker created' + (err ? ', error=' + err.message : ''));
    cb();
    debug_log('  trigger_watchpaths(): scheduling marker cleanup in 10s');
    setTimeout(function() {
      debug_log('  trigger_watchpaths(): removing marker now');
      fs.unlink(marker, function(err) {
        debug_log('  trigger_watchpaths(): marker removed' + (err ? ', error=' + err.message : ''));
      });
    }, 10000);
  });
}

exports.deleteOsquery = (cb) => {
  exec(`${paths.current}/bin/trinity --uninstall`, () => {
    if (cb && typeof cb !== 'undefined') cb();
  });
};