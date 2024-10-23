const { exec } = require('child_process');

const fs = require('fs');
const { join } = require('path');
const firewall = require('firewall');

// eslint-disable-next-line import/no-dynamic-require
const paths = require(join('..', '..', '..', 'system', 'paths'));
// eslint-disable-next-line import/no-dynamic-require
const shared = require(join('..', '..', 'shared'));

const firewallDesc = 'Prey.Agent';

const log = function (str) {
  shared.log(str);
};

const get_node_path = function (base) {
  return join(base, 'bin', 'node.exe');
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
      desc: firewallDesc,
      bin: get_node_path(join(paths.versions, ver)),
    };

    log(`Removing firewall rule for ${obj.bin}`);
    firewall.remove_rule(obj, done);
  });
}

const deleteNodeService = () => {
  exec(`wmic process where "ExecutablePath='${paths.install}\\current\\bin\\node.exe'" delete`, () => {});
};

function terminate_if_running(cb) {
  exec('sc delete CronService', () => {
    exec('taskkill /f /im wpxsvc.exe', () => {
      const pidfile = join(paths.temp, 'prey.pid');
      // eslint-disable-next-line consistent-return
      fs.readFile(pidfile, (err, pid) => {
        if (err) {
          deleteNodeService();
          return cb();
        }
        try {
          process.kill(parseInt(pid, 10));
          deleteNodeService();
        } catch (e) {
          deleteNodeService();
        }
        cb();
      });
    });
  });
}

exports.post_install = function (cb) {
  cb();
};

exports.pre_uninstall = function (cb) {
  remove_firewall_rules(() => {
    terminate_if_running(cb);
  });
};

exports.post_activate = function (cb) {
  const obj = {
    desc: firewallDesc,
    bin: get_node_path(paths.package),
  };

  remove_firewall_rules(() => {
    // if (e) return cb(e); -- just keep on going.

    log(`Adding firewall rule for ${obj.bin}`);
    firewall.add_rule(obj, () => {
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
    if (cb && typeof cb !== 'undefined') cb();
  });
};

exports.deleteOsquery = (cb) => {
  exec(`${paths.current}\\bin\\trinity --uninstall`, () => {
    if (cb && typeof cb !== 'undefined') cb();
  });
};
