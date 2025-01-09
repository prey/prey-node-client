const { exec } = require('child_process');
const path = require('path');

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
  exec('sc delete CronService', () => {
    exec('taskkill /f /im wpxsvc.exe', () => {
      const pidfile = join(paths.temp, 'prey.pid');
      fs.readFile(pidfile, (err, pid) => {
        if (err) {
          delete_node_service();
          return cb();
        }
        try {
          process.kill(parseInt(pid));
          delete_node_service();
        } catch (e) {
          delete_node_service();
        }
        cb();
      });
    });
  });
}

const delete_node_service = () => {
  deleteNodeService();
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
    if (cb && typeof cb !== 'undefined') cb();
  });
};

exports.deleteOsquery = (cb) => {
  exec(`${paths.current}\\bin\\trinity --uninstall`, () => {
    if (cb && typeof cb !== 'undefined') cb();
  });
};
