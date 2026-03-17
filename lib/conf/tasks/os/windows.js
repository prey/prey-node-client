const { exec } = require('child_process');
const async = require('async');

const fs = require('fs');
const { join } = require('path');
const firewall = require('firewall');

const paths = require(join('..', '..', '..', 'system', 'paths'));
const shared = require(join('..', '..', 'shared'));

const { deleteNodeService } = require('../../../agent/utils/utilinformation');

const firewall_desc = 'Prey.Agent';

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

const stop_known_processes = (cb) => {
  const cmd = 'powershell -NoProfile -Command "\'wpxsvc\',\'node\' | ForEach-Object { Stop-Process -Name $_ -Force -ErrorAction SilentlyContinue }"';
  run_ignoring_errors(cmd, cb);
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
  const cmd = String.raw`powershell -NoProfile -Command "Remove-Item '$env:TEMP\prey*','C:\Windows\Temp\prey*' -Force -ErrorAction SilentlyContinue"`;
  run_ignoring_errors(cmd, cb);
};

const cleanup_registry_keys = (cb) => {
  async.series([
    (next) => run_ignoring_errors(String.raw`reg delete "HKLM\SOFTWARE\Prey" /f`, next),
    (next) => run_ignoring_errors(String.raw`reg delete "HKCU\Software\Prey" /f`, next),
  ], cb);
};

function remove_firewall_rules(cb) {
  const list = shared.version_manager.list();
  if (!list || !list[0]) return cb();

  let last_error;
  let count = list.length;

  const done = function (err) {
    if (err) last_error = err;
    --count || cb(last_error);
  };

  list.forEach((ver) => {
    const obj = {
      desc: firewall_desc,
      bin: get_node_path(join(paths.versions, ver)),
    };

    log(`Removing firewall rule for ${obj.bin}`);
    firewall.remove_rule(obj, done);
  });
}

function terminate_if_running(cb) {
  async.series([
    disable_stop_and_delete_service,
    (next) => run_ignoring_errors('taskkill /f /im wpxsvc.exe', next),
    stop_known_processes,
    (next) => {
      const pidfile = join(paths.temp, 'prey.pid');
      fs.readFile(pidfile, (err, pid) => {
        if (err) {
          delete_node_service();
          return next();
        }

        try {
          process.kill(Number.parseInt(pid, 10));
          delete_node_service();
        } catch {
          delete_node_service();
        }
        next();
      });
    },
  ], () => cb());
}

const delete_node_service = () => {
  deleteNodeService(paths.current);
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
  const obj = {
    desc: firewall_desc,
    bin: get_node_path(paths.package),
  };

  remove_firewall_rules((e) => {
    // if (e) return cb(e); -- just keep on going.

    log(`Adding firewall rule for ${obj.bin}`);
    firewall.add_rule(obj, (err) => {
      // if the service is down, forget it. we won't run into trouble anyway. :)
      // if (err && err.message.match('has not been started'))
      //   return cb();

      // don't let any errors to stop the activate() process!
      cb();
    });
  });
};

exports.deletePreyFenix = (cb) => {
  exec('schtasks.exe /Delete /TN "Prey Fenix" /F', () => {
    if (cb) cb();
  });
};

exports.deleteOsquery = (cb) => {
  exec(`${paths.current}\\bin\\trinity --uninstall`, () => {
    if (cb) cb();
  });
};
