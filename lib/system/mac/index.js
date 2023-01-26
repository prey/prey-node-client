//////////////////////////////////////////
// Prey Node.js Mac Client Functions
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var cp       = require('child_process'),
    os_name  = process.platform.replace('darwin', 'mac'),
    os       = require('os'),
    paths    = require('./../paths');

// var get_logged_user_cmd = "stat /dev/console | cut -d' ' -f5";
// var get_logged_user_pid_cmd = "ps ax | grep -v grep | grep loginwindow | awk '{print $1}'"
// var get_logged_users_cmd = "ps aux | grep -v grep | grep loginwindow | awk '{print $1}'"
var get_logged_users_cmd = "stat -f%Su /dev/console",
    get_admin_user_cmd   = "dscl . read /Groups/admin GroupMembership",
    python_version       = ' -c "import platform; print(platform.python_version())"';

var get_logged_user_pid = function() {
  var cmd = "ps ax | grep loginwindow.app | head -1 | awk '{print $1}'";
  // var cmd = "ps aux | awk -v Var=" + process.env.LOGGED_USER + " '/loginwindow.app/ && match(Var,$1) { print $2 }'";

  cp.exec(cmd, function(err, stdout, stderr){
    process.env.LOGGED_USER_PID = stdout.toString().trim();
    // console.log("Logged user PID is " + process.env.LOGGED_USER_PID);
  });
};

exports.find_logged_user = function(cb) {
  cp.exec(get_logged_users_cmd, function(err, out) {
    if (err) return cb(err)

    var items = out.split('\n');
    var non_root = items.filter(function(x){ return x != '' && x != 'root' });

    if (non_root.length == 0)
      return cb(new Error("Couldn't find logged user."))

    return cb(null, non_root[0]);
  });
}

exports.find_admin_user = function(cb) {
  cp.exec(get_admin_user_cmd, function(err, out) {
    if (err) return cb(err);

    var admins = out.replace(/\n/g, '').split(' ');
    var non_root = admins.filter(function(x){ return x != '' && x != 'root' && x != 'GroupMembership:'});

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

exports.get_os_name = function(cb) {
  cb(null, os_name);
}

exports.get_os_version = function(cb) {
  var release;
  try {
    release = cp.execSync('sw_vers -productVersion');
  } catch (e) {
    return cb(new Error("Unable to determine Mac OS version."))
  }
  cb(null, release.toString().trim());
}

exports.get_lang = function(cb) {
  var lang = 'en',
      cmd  = "osascript -e 'user locale of (get system info)'";
  cp.exec(cmd, function(err, stdout) {
    if (!err && stdout.substring(0, 2) == 'es') lang = 'es';
    cb(lang);
  });
}

exports.process_running = function(process_name, callback) {
  var cmd = 'ps ax | grep -v grep | grep -q ' + process_name + ' && echo 1';
  cp.exec(cmd, function(err, stdout) {
    callback(stdout && stdout.toString().trim() == '1')
  });
}

exports.get_current_hostname = (callback) => {
  cp.exec("scutil --get LocalHostName", (err, stdout) => {
    if (err) return callback(err);
    callback(null, stdout.split('\n')[0]);
  });
}

exports.get_python_version = (callback) => {
  // Asks first if the device has python2, if it fails asks for python3
  cp.exec("python" + python_version + " || python3" + python_version, (err, stdout) => {
    if (err) return callback(err);

    callback(null, stdout.split('\n')[0]);
  })  
}

exports.get_processor_info = function(callback) {
  var cpus = os.cpus();
  var cpu_info = {
    model: cpus[0].model.trim(),
    speed: cpus[0].speed,
    cores: cpus.length
  };
  if (exports.is_m1_or_m2())
      cpu_info.speed = cpus[0].speed * 100; ///////////////////////when it is M1, it returns the value in Ghz, it is the reason because it is multiplied by 100
  callback(null, cpu_info);
};

exports.is_m1_or_m2 = function(){
  var cpus = os.cpus();
  var  model = cpus[0].model.trim();
  if(model.includes("M1") || model.includes("M2")) 
    return true;
  return false;
}

exports.get_info_chip = function(){
  var cpus = os.cpus();
  var  model = cpus[0].model.trim();
  return model;
  
}

exports.get_prey_user_version = function(cb) {

  const path = (paths.versions) ? `${paths.versions}/prey-user -v` : '/usr/local/lib/prey/versions/prey-user -v' ;
  var prey_user_version;
  try {
    prey_user_version = cp.execSync(path);
  } catch (e) {
    return cb(new Error("Unable to get prey-user-version."))
  }
  cb(null, prey_user_version.toString().trim());
}