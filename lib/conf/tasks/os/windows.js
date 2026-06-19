const { exec } = require('child_process');
const async = require('async');
const fs = require('fs');
const os = require('os');
const { join } = require('path');

const paths = require(join('..', '..', '..', 'system', 'paths'));
const shared = require(join('..', '..', 'shared'));
const winsvc = require('../../../system/windows/winsvc');
const edrLog = require('../../../system/windows/edr_log');

const { deleteNodeService } = require('../../../agent/utils/utilinformation');

const firewall_desc = 'Prey.Agent';
const FIREWALL_MIN_WINSVC_VERSION = '2.0.34';

const log = function (str) {
  shared.log(str);
};

const get_node_path = function (base) {
  return join(base, 'bin', 'node.exe');
};

const run_ignoring_errors = (cmd, cb) => {
  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      log(`Ignoring command error for: ${cmd}`);
      if (stderr) {
        log(stderr.toString().trim());
      }
    }
    cb();
  });
};

const disable_stop_and_delete_service = (cb) => {
  async.series([
    (next) => run_ignoring_errors('sc.exe config CronService start= disabled', next),
    (next) => run_ignoring_errors('sc.exe stop CronService', next),
    (next) => setTimeout(next, 3000),
    (next) => run_ignoring_errors('sc.exe delete CronService', next),
  ], cb);
};

const get_registry_install_dir = (cb) => {
  exec(String.raw`reg query "HKLM\SOFTWARE\Prey" /v INSTALLDIR`, (err, stdout) => {
    if (err || !stdout) return cb(null, null);

    const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const installLine = lines.find((line) => line.toUpperCase().startsWith('INSTALLDIR'));
    if (!installLine) return cb(null, null);

    const parts = installLine.split(/\s{2,}/);
    const installDir = parts[2] || null;
    cb(null, installDir);
  });
};

const remove_directory_if_exists = (target, cb) => {
  if (!target) return cb();
  if (!fs.existsSync(target)) return cb();

  log(`Removing directory ${target}`);
  fs.rm(target, { recursive: true, force: true }, () => cb());
};

const cleanup_install_directories = (cb) => {
  get_registry_install_dir((_, installDirFromRegistry) => {
    const fallbackDir = join(process.env.WINDIR || String.raw`C:\Windows`, 'Prey');
    const installDirs = [installDirFromRegistry, paths.install, fallbackDir]
      .filter(Boolean)
      .filter((dir, index, arr) => arr.indexOf(dir) === index);

    async.eachSeries(installDirs, remove_directory_if_exists, () => cb());
  });
};

const cleanup_temp_files = (cb) => {
  const dirs = [
    os.tmpdir(),
    join(process.env.WINDIR || String.raw`C:\Windows`, 'Temp'),
  ];
  edrLog(`cleanup_temp_files: scanning dirs=${dirs.join(', ')}`);
  async.each(dirs, (dir, next) => {
    fs.readdir(dir, (err, files) => {
      if (err) { edrLog(`cleanup_temp_files: readdir error dir=${dir} err=${err.message}`); return next(); }
      const targets = (files || []).filter((f) => f.toLowerCase().startsWith('prey'));
      edrLog(`cleanup_temp_files: dir=${dir} found=${targets.length} prey* entries`);
      async.each(targets, (f, done) => {
        edrLog(`cleanup_temp_files: removing ${join(dir, f)}`);
        fs.rm(join(dir, f), { recursive: true, force: true }, () => done());
      }, next);
    });
  }, cb);
};

const cleanup_registry_keys = (cb) => {
  async.series([
    (next) => run_ignoring_errors(String.raw`reg delete "HKLM\SOFTWARE\Prey" /f`, next),
    (next) => run_ignoring_errors(String.raw`reg delete "HKCU\Software\Prey" /f`, next),
  ], cb);
};

function remove_firewall_rules(cb) {
  log(`Removing firewall rules for ${firewall_desc}`);
  winsvc.supports(FIREWALL_MIN_WINSVC_VERSION, (supported) => {
    if (!supported) {
      edrLog('remove_firewall_rules: winsvc not supported — using powershell fallback');
      const cmd = `powershell -NoProfile -NonInteractive -Command "Remove-NetFirewallRule -DisplayName '${firewall_desc}' -ErrorAction SilentlyContinue"`;
      return run_ignoring_errors(cmd, cb);
    }
    edrLog('remove_firewall_rules: using winsvc HTTP firewall-rule remove');
    winsvc.http_action('firewall-rule', { operation: 'remove', name: firewall_desc }, (err) => {
      if (!err) { edrLog('remove_firewall_rules: removed via winsvc HTTP'); return cb(); }
      edrLog(`remove_firewall_rules: HTTP failed (${err.message}) — CLI fallback`);
      log('winsvc HTTP unavailable, using CLI fallback for firewall remove');
      exec(`"${winsvc.get_bin()}" -firewall=remove -firewall-name="${firewall_desc}"`, (cliErr) => {
        if (!cliErr) { edrLog('remove_firewall_rules: removed via CLI fallback'); return cb(); }
        edrLog(`remove_firewall_rules: CLI fallback error (${cliErr.message}) — powershell fallback`);
        const psCmd = `powershell -NoProfile -NonInteractive -Command "Remove-NetFirewallRule -DisplayName '${firewall_desc}' -ErrorAction SilentlyContinue"`;
        run_ignoring_errors(psCmd, cb);
      });
    });
  });
}

function add_firewall_rule(bin, cb) {
  winsvc.supports(FIREWALL_MIN_WINSVC_VERSION, (supported) => {
    if (!supported) {
      edrLog(`add_firewall_rule: winsvc not supported — using powershell fallback bin=${bin}`);
      const cmd = `powershell -NoProfile -NonInteractive -Command "New-NetFirewallRule -DisplayName '${firewall_desc}' -Direction Inbound -Action Allow -Program '${bin}' -Enabled True"`;
      return run_ignoring_errors(cmd, cb);
    }
    edrLog(`add_firewall_rule: using winsvc HTTP firewall-rule add bin=${bin}`);
    log(`Adding firewall rule via winsvc for ${bin}`);
    winsvc.http_action('firewall-rule', { operation: 'add', name: firewall_desc, program: bin }, (err) => {
      if (!err) { edrLog('add_firewall_rule: added via winsvc HTTP'); return cb(); }
      edrLog(`add_firewall_rule: HTTP failed (${err.message}) — CLI fallback`);
      log('winsvc HTTP unavailable, using CLI fallback for firewall add');
      exec(`"${winsvc.get_bin()}" -firewall=add -firewall-name="${firewall_desc}" -firewall-program="${bin}"`, (cliErr) => {
        if (!cliErr) { edrLog('add_firewall_rule: added via CLI fallback'); return cb(); }
        edrLog(`add_firewall_rule: CLI fallback error (${cliErr.message}) — powershell fallback`);
        const psCmd = `powershell -NoProfile -NonInteractive -Command "New-NetFirewallRule -DisplayName '${firewall_desc}' -Direction Inbound -Action Allow -Program '${bin}' -Enabled True"`;
        run_ignoring_errors(psCmd, cb);
      });
    });
  });
}

function terminate_if_running(cb) {
  edrLog('terminate_if_running: start');
  async.series([
    disable_stop_and_delete_service,
    (next) => {
      const pidfile = join(paths.temp, 'prey.pid');
      fs.readFile(pidfile, (err, pid) => {
        if (err) {
          edrLog(`terminate_if_running: pidfile not found (${err.message}) — skip process.kill`);
          delete_node_service();
          return next();
        }

        const pidNum = Number.parseInt(pid, 10);
        edrLog(`terminate_if_running: read pidfile pid=${pidNum} — calling process.kill`);
        try {
          process.kill(pidNum);
          edrLog(`terminate_if_running: process.kill(${pidNum}) OK`);
          delete_node_service();
        } catch (killErr) {
          edrLog(`terminate_if_running: process.kill(${pidNum}) threw (${killErr.message}) — process already gone`);
          delete_node_service();
        }
        next();
      });
    },
  ], () => { edrLog('terminate_if_running: done'); cb(); });
}

const delete_node_service = () => {
  deleteNodeService(join(paths.temp, 'prey.pid'));
};

exports.post_install = function (cb) {
  cb();
};

exports.pre_uninstall = function (cb) {
  remove_firewall_rules((e) => {
    // if (e) return cb(e); -- just keep on going.

    terminate_if_running(cb);
  });
};

exports.deep_cleanup = function (cb) {
  async.series([
    cleanup_install_directories,
    cleanup_temp_files,
    cleanup_registry_keys,
  ], () => cb());
};

exports.post_activate = function (cb) {
  const bin = get_node_path(paths.package);

  remove_firewall_rules(() => {
    log(`Adding firewall rule for ${bin}`);
    add_firewall_rule(bin, () => cb());
  });
};

exports.deletePreyFenix = (cb) => {
  exec('schtasks.exe /Delete /TN "Prey Fenix" /F', () => { if (cb) cb(); });
};

exports.deleteOsquery = (cb) => {
  exec(`${paths.current}\\bin\\trinity --uninstall`, () => {
    if (cb) cb();
  });
};

exports.cleanup_registry_keys = cleanup_registry_keys;
