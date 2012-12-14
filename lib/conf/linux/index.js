var fs     = require('fs'),
    path   = require('path'),
    exec   = require('child_process').exec,
    system = require('./../../system');

var init_script_name  = 'prey-trigger',
    common_initd_path = '/etc/init.d',
    trigger_script    = 'prey-trigger.py',
    bin_path          = system.paths.current_bin,
    trigger_script_path = path.join(system.paths.current, 'bin', 'linux', trigger_script);

var weird_initd_paths = {
  redhat: '/etc/rc.d/init.d',
  arch: '/etc/rc.d'
};

var initd_commands = {
  debian: {
    load: 'update-rc.d $1 defaults',
    unload: 'update-rc.d -f $1 remove'
  },
  redhat: {
    load: 'chkconfig $1 on',
    unload: 'chkconfig $1 off'
  },
  suse: {
    load: 'chkconfig --add $1',
    unload: 'chkconfig --del $1'
  }
};

initd_commands.ubuntu = initd_commands.debian;
initd_commands.linuxmint = initd_commands.debian;
initd_commands.fedora = initd_commands.redhat;

/////////////////////////////////////////////////
// helpers
/////////////////////////////////////////////////

var get_distro_name = function(callback){
  var cmd = 'lsb_release -i';

  exec(cmd, function(err, stdout){
    if (err) return callback(err);

    var name = stdout.toString().split(":")[1].trim().toLowerCase();
    callback(null, name);
  });
};

var get_init_script_path = function(distro){
  var initd_path = weird_initd_paths[distro] || common_initd_path;
  return path.join(initd_path, init_script_name);
};

var copy_init_script = function(distro, callback){
  var full_path = get_init_script_path(distro);

  fs.exists(full_path, function(exists){
    if (exists) {
      fs.unlink(full_path);
    }

    var template = fs.readFileSync(path.resolve(__dirname + "/" + init_script_name)),
        data = template.toString()
                       .replace('{{trigger_script}}', trigger_script_path)
                       .replace('{{prey_bin}}', bin_path);

    if (data === template.toString())
      return callback(new Error("Unable to replace template variables!"));

    fs.chmod(trigger_script_path, 0755, function(err){
      if (err) return callback(err);
      fs.writeFile(full_path, data, callback);
    });

  });
};

var remove_init_script = function(distro, callback){
  var file = get_init_script_path(distro);
  fs.unlink(file, callback);
};

var load_init_script = function(distro, callback){
  var command = initd_commands[distro].load.replace('$1', init_script_name);
  exec(command, callback);
};

var unload_init_script = function(distro, callback){
  var command = initd_commands[distro].unload.replace('$1', init_script_name);
  exec(command, callback);
};

/////////////////////////////////////////////////
// hooks
/////////////////////////////////////////////////

exports.post_install = function(callback) {
  get_distro_name(function(err, distro) {
    if (err) return callback(err);

    copy_init_script(distro, function(err){
      if (err) return callback(err);

      load_init_script(distro, callback);
    });
  });
};

exports.pre_uninstall = function(callback){
  get_distro_name(function(err, distro){
    if (err) return callback(err);

    unload_init_script(distro, function(err){
      if (err) return callback(err);

      remove_init_script(distro, function(err){
        if (!err || err.code === 'ENOENT') callback();
        else callback(err);
      });
    });
  });
};
