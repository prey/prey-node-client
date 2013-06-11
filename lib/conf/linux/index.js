var fs     = require('fs'),
    path   = require('path'),
    exec   = require('child_process').exec,
    system = require('./../../system');

var running_user      = 'prey',
    init_script_name  = 'prey-agent',
    common_initd_path = '/etc/init.d',
    bin_path          = system.paths.current_bin;

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
initd_commands.elementary_os = initd_commands.debian;
initd_commands.fedora = initd_commands.redhat;

/////////////////////////////////////////////////
// helpers
/////////////////////////////////////////////////

var get_init_script_path = function(distro){
  var initd_path = weird_initd_paths[distro] || common_initd_path;
  return path.join(initd_path, init_script_name);
};

var copy_init_script = function(distro, callback){
  var full_path = get_init_script_path(distro),
      initd_template = path.join(__dirname, init_script_name);

  fs.readFile(initd_template, function(err, template){
    if (err) return callback(err);

    var data = template.toString()
               .replace('{{prey_bin}}', bin_path)
               .replace('{{user}}', running_user);

    if (data === template.toString())
      return callback(new Error("Unable to replace template variables!"));

    fs.writeFile(full_path, data, function(err){
      if (err) return callback(err);
      fs.chmod(full_path, 0755, callback);
    });
  });

};

var remove_init_script = function(distro, callback){
  var file = get_init_script_path(distro);
  fs.unlink(file, callback);
};

var load_init_script = function(distro, callback){
  var distro_commands = initd_commands[distro];
  if (!distro_commands)
    return callback(new Error('Unrecognized distro: ' + distro));

  var command = distro_commands.load.replace('$1', init_script_name);
  exec(command, callback);
};

var unload_init_script = function(distro, callback){
  var distro_commands = initd_commands[distro];
  if (!distro_commands)
    return callback(new Error('Unrecognized distro: ' + distro));

  var command = distro_commands.unload.replace('$1', init_script_name);
  exec(command, callback);
};

/////////////////////////////////////////////////
// hooks
/////////////////////////////////////////////////

exports.post_install = function(callback) {
  system.get_os_name(function(err, name) {
    if (err) return callback(err);

    var distro = name.toLowerCase().replace(' ', '_');

    remove_init_script(distro, function(err){
     if (err && err.code !== 'ENOENT')
       return callback(err);

     copy_init_script(distro, function(err){
        if (err) return callback(err);

        load_init_script(distro, callback);
      });
    });

  });
};

exports.pre_uninstall = function(callback){
  system.get_os_name(function(err, name){
    if (err) return callback(err);

    var distro = name.toLowerCase().replace(' ', '_');

    unload_init_script(distro, function(err){
      if (err) return callback(err);

      remove_init_script(distro, function(err){
        if (!err || err.code === 'ENOENT') callback();
        else callback(err);
      });
    });
  });
};
