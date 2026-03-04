const fs = require('fs');
const { exec } = require('child_process');
const { join } = require('path');

const common = require(join('..', '..', '..', 'common'));
const paths = require(join('..', '..', '..', 'system', 'paths'));
const shared = require(join('..', '..', 'shared'));

const log = (str) => shared.log(str);

const debug_log_path = '/tmp/prey_upgrade_debug.log';
function debug_log(msg) {
  try {
    const now = new Date();
    const ts = now.toISOString().replace('T', ' ').replace('Z', '');
    fs.appendFileSync(debug_log_path, `[${ts}] [mac] ${msg}\n`);
  } catch (e) {}
}

exports.post_install = function (cb) {
  cb();
};

exports.pre_uninstall = function (cb) {
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
exports.post_activate = function (cb) {
  debug_log('post_activate() called');
  debug_log(`  UPGRADING_FROM=${process.env.UPGRADING_FROM || '(not set)'}`);
  debug_log(`  process.pid=${process.pid}`);
  debug_log(`  paths.install=${paths.install}`);

  if (!process.env.UPGRADING_FROM) {
    debug_log('  No UPGRADING_FROM, returning early');
    return cb();
  }

  const old_version = process.env.UPGRADING_FROM;
  const my_pid = process.pid;

  log(`Upgrade from ${old_version}. Ensuring daemon runs new version...`);

  // Step 1: Kill any stale daemon immediately
  debug_log('  Step 1: find_and_kill START (first pass)');
  find_and_kill(old_version, my_pid, () => {
    debug_log('  Step 1: find_and_kill DONE');

    // Step 2: Wait for launchd ThrottleInterval to expire.
    // set_current's rename triggers a failed WatchPaths start (current briefly
    // missing), which puts launchd into a 10s throttle. We must wait it out
    // or our WatchPaths trigger gets silently ignored.
    log('Waiting 15s for launchd ThrottleInterval to expire...');
    debug_log(`  Step 2: setTimeout(15000) START at ${new Date().toISOString()}`);
    setTimeout(() => {
      debug_log(`  Step 2: setTimeout(15000) FIRED at ${new Date().toISOString()}`);
      // Step 4: Trigger WatchPaths. Throttle has expired so launchd
      // will process this and start the daemon from the updated 'current'.
      log('ThrottleInterval expired. Triggering WatchPaths...');
      debug_log('  Step 4: trigger_watchpaths START');
      trigger_watchpaths(() => {
        debug_log('  Step 4: trigger_watchpaths DONE. post_activate complete.');
        cb();
      });
    }, 15000);
  });
};

// Finds daemon processes by process title (`prx`) and kills them,
// excluding the current activation process PID.
function parse_ps_line(line) {
  const match = line.match(/^\s*(\d+)\s+(.*)$/);
  if (!match) return null;
  return {
    pid: parseInt(match[1], 10),
    args: match[2] || '',
  };
}

function is_prx_command(args) {
  if (!args) return false;
  const trimmed = args.trim();
  return trimmed === 'prx' || trimmed.indexOf('prx ') === 0 || trimmed.indexOf('/prx ') !== -1 || /\/prx$/.test(trimmed);
}

function get_last_wings_version(cb) {
  const log_path = '/var/log/prey.log';
  const wings_regex = /PREY\s+(\d+\.\d+\.\d+)\s+spreads its wings!/;

  fs.readFile(log_path, 'utf8', (err, data) => {
    if (err) {
      debug_log(`  get_last_wings_version(): read failed (${log_path}): ${err.message}`);
      return cb(err);
    }

    const lines = (data || '').split('\n').slice(-200);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const match = lines[i].match(wings_regex);
      if (match && match[1]) {
        debug_log(`  get_last_wings_version(): found ${match[1]} in recent log lines`);
        return cb(null, match[1]);
      }
    }

    debug_log('  get_last_wings_version(): no PREY x.y.z spreads its wings! match in last 200 lines');
    return cb(null, null);
  });
}

function find_and_kill(old_version, my_pid, cb) {
  const installing_version = common.version;
  debug_log(`  find_and_kill(): old_version=${old_version}, my_pid=${my_pid}`);
  debug_log(`  find_and_kill(): installing_version=${installing_version}`);
  debug_log('  find_and_kill(): mode=prx-only');

  const kill_matching_prx = () => {
    exec('ps -eo pid,args', (err, stdout) => {
      if (err || !stdout) {
        log('Could not list processes.');
        debug_log(`  find_and_kill(): ps command failed: ${err ? err.message : 'no stdout'}`);
        return cb();
      }

      debug_log('  find_and_kill(): ps output START >>>');
      debug_log(stdout);
      debug_log('  find_and_kill(): ps output END <<<');

      const pids = [];
      stdout.split('\n').forEach((line) => {
        const parsed = parse_ps_line(line);
        if (!parsed || !parsed.pid) return;
        if (parsed.pid === my_pid) return;
        if (!is_prx_command(parsed.args)) return;
        if (line.indexOf('grep') !== -1) return;

        pids.push(parsed.pid);
      });

      if (!pids.length) {
        log('No stale daemon found.');
        debug_log('  find_and_kill(): no prx daemons found');
        return cb();
      }

      const unique = [];
      const seen = {};
      pids.forEach((pid) => {
        if (seen[pid]) return;
        seen[pid] = true;
        unique.push(pid);
      });

      log(`Killing daemon PIDs: ${unique.join(', ')}`);
      unique.forEach((pid) => {
        try {
          process.kill(pid, 'SIGKILL');
          debug_log(`  find_and_kill(): killed PID ${pid} OK`);
        } catch (e) {
          debug_log(`  find_and_kill(): kill PID ${pid} failed: ${e.message}`);
        }
      });

      wait_for_death(unique, cb);
    });
  };

  get_last_wings_version((err, last_wings_version) => {
    if (err) {
      debug_log('  find_and_kill(): proceeding without log version check (read error)');
      return kill_matching_prx();
    }

    if (!last_wings_version) {
      debug_log('  find_and_kill(): proceeding without log version check (no recent wings line)');
      return kill_matching_prx();
    }

    if (last_wings_version === installing_version) {
      log(`Skipping kill: latest prey.log version (${last_wings_version}) matches installing version.`);
      debug_log(`  find_and_kill(): skip kill because last_wings_version (${last_wings_version}) === installing_version (${installing_version})`);
      return cb();
    }

    debug_log(`  find_and_kill(): proceeding with kill because last_wings_version (${last_wings_version}) !== installing_version (${installing_version})`);
    return kill_matching_prx();
  });
}

// Polls until all PIDs are dead. Gives up after 10s.
function wait_for_death(pids, cb) {
  let elapsed = 0;
  const interval = 500;
  const max_wait = 10000;
  debug_log(`  wait_for_death(): watching PIDs=${JSON.stringify(pids)}`);

  function check() {
    const alive = pids.filter((pid) => {
      try { process.kill(pid, 0); return true; } catch (e) { return false; }
    });
    debug_log(`  wait_for_death(): elapsed=${elapsed}ms, alive=${JSON.stringify(alive)}`);
    if (!alive.length) {
      log('All daemon processes have exited.');
      debug_log('  wait_for_death(): all dead');
      return cb();
    }
    elapsed += interval;
    if (elapsed >= max_wait) {
      log('Timeout waiting for PIDs to die. Proceeding.');
      debug_log(`  wait_for_death(): TIMEOUT after ${elapsed}ms, still alive=${JSON.stringify(alive)}`);
      return cb();
    }
    setTimeout(check, interval);
  }
  check();
}

// Creates a marker file to trigger WatchPaths. The file is kept for 10s
// so it persists well beyond any ThrottleInterval edge case.
function trigger_watchpaths(cb) {
  const marker = join(paths.install, '.prey_updated');
  log(`Creating WatchPaths marker: ${marker}`);
  debug_log(`  trigger_watchpaths(): creating marker at ${marker}`);
  fs.writeFile(marker, `upgrade-${Date.now()}`, (err) => {
    debug_log(`  trigger_watchpaths(): marker created${err ? `, error=${err.message}` : ''}`);
    cb();
    debug_log('  trigger_watchpaths(): scheduling marker cleanup in 10s');
    setTimeout(() => {
      debug_log('  trigger_watchpaths(): removing marker now');
      fs.unlink(marker, (err) => {
        debug_log(`  trigger_watchpaths(): marker removed${err ? `, error=${err.message}` : ''}`);
      });
    }, 10000);
  });
}

exports.deleteOsquery = (cb) => {
  exec(`${paths.current}/bin/trinity --uninstall`, () => {
    if (cb && typeof cb !== 'undefined') cb();
  });
};
