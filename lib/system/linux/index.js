"use strict";

//////////////////////////////////////////
// Prey Node.js Linux Client Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs       = require('fs'),
    cp       = require('child_process'),
    release  = require('os').release,
    distro   = require('linus'),
    exec     = cp.exec,
    execSync = cp.execSync;

const get_admin_user_cmd = "getent group adm";

exports.get_os_name = distro.name;

exports.get_os_version = function(cb) {
  var release;
  try {
    release = execSync('lsb_release -rs');
  } catch (e) {
    return cb(new Error("Unable to determine Linux OS version."))
  }
  cb(null, release.toString().trim());
}

/**
 *  Callsback the user logged in.
 **/
exports.find_logged_user = function(callback) {
  //var daemons = 'ssh-agent|gnome-keyring-daemon|kde-authentication-agent',
  const command = `for s in $(loginctl list-sessions --no-legend | awk '{print $1}'); do
    t=$(loginctl show-session $s -p Type --value);
    a=$(loginctl show-session $s -p Active --value);
    u=$(loginctl show-session $s -p Name --value);
    if [ "$a" = "yes" ] && { [ "$t" = "x11" ] || [ "$t" = "wayland" ]; }; then
      echo $u; break;
    fi;
  done`;

  exec(command, function(err, out) {
    if (err) return callback(err);

    var first = out.toString().split('\n')[0];
    if (first == 'root' || first == 'lightdm' || first == '')
      return callback(new Error("Couldn't find logged user."))

    callback(null, first);
  });
};

exports.find_admin_user = function(cb) {
  exec(get_admin_user_cmd, function(err, out) {
    if (err) return cb(err);

    var admins = out.replace(/\n/g, '').split(',');
    admins.shift();

    var non_root = admins.filter(function(x){ return x != '' && x != 'root' && x != 'syslog'});

    if (non_root.length == 0) return cb(new Error("Couldn't find admin user."))

    // Return the logged user if it's admin
    exports.find_logged_user(function(err, logged_user) {
      if (err) cb(null, non_root[0]);

      if (non_root.indexOf(logged_user) != -1)
        return cb(null, logged_user);
      else
        return cb(null, non_root[0]);
    });
  });
}

exports.process_running = function(process_name, callback){
  var cmd = 'ps ax | grep -v grep | grep -q ' + process_name + ' && echo 1';
  exec(cmd, function(err, stdout){
    callback(stdout && stdout.toString().trim() === '1');
  });
};

exports.get_env = (callback) => {
  let result = {
    user: null,
    type: null,
    display: null,
    xauthority: null
  };

  // Get active graphic user
  try {
    const cmdUser = `
      for s in $(loginctl list-sessions --no-legend | awk '{print $1}'); do
        t=$(loginctl show-session $s -p Type --value);
        a=$(loginctl show-session $s -p Active --value);
        u=$(loginctl show-session $s -p Name --value);
        uid=$(loginctl show-session "$s" -p User --value)
        if [ "$a" = "yes" ] && { [ "$t" = "x11" ] || [ "$t" = "wayland" ]; }; then
          echo "$u $uid $t";
          break;
        fi;
      done`;
    let out = execSync(cmdUser).toString().trim().split(" ");
    result.user = out[0];
    result.uid  = out[1];
    result.type = out[2];
  } catch (err) {
    return callback(new Error("Cannot detect graphical user: " + err));
  }

  let runPath = `/run/user/${result.uid}/`;

  // DISPLAY using current user UID
  try {
    const xDir = "/tmp/.X11-unix";
    if (fs.existsSync(xDir)) {
      const entries = fs.readdirSync(xDir).filter(f => f.startsWith("X"));
      for (const entry of entries) {
        const socketPath = `${xDir}/${entry}`;
        const stat = fs.statSync(socketPath);
        if (stat.uid.toString() === result.uid) {
          result.display = `:${entry.substring(1)}`;
          break;
        }
      }
    }
  } catch (e) {
    return callback(new Error("DISPLAY detection error: " + e));
  }

  // Wayland fallback
  if (!result.display && fs.existsSync(runPath + "wayland-0")) {
    result.display = ":0";
  }

  // XAUTHORITY
  let patterns = [
    `${runPath}.mutter-Xwaylandauth.*`,
    `${runPath}gdm/Xauthority`,
    `/home/${result.user}/.Xauthority`
  ];

  for (let p of patterns) {
    try {
      let found = execSync(`ls ${p} 2>/dev/null`).toString().split("\n").filter(Boolean);
      if (found.length > 0) {
        result.xauthority = found[0];
        break;
      }
    } catch {}
  }

  if (!result.xauthority) {
    result.xauthority = `/home/${result.user}/.Xauthority`;
  }
  return callback(null, result);
}

exports.get_lang = function(cb) {
  var lang = 'en',
      cmd  = "locale | awk 'NR==1'";
  exec(cmd, function(err, stdout) {
    if (!err && stdout.substring(5, 7) == 'es') lang = 'es';
    cb(lang);
  });
}

exports.get_current_hostname = (callback) => {
  exec("hostname", (err, stdout) => {
    if (err) return callback(err);
    
    callback(null, stdout.split('\n')[0]);
  });
}
