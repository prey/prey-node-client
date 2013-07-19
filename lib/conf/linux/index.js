var fs           = require('fs'),
    path         = require('path'),
    exec         = require('child_process').exec,
    system       = require('./../../system');

var running_user = 'prey',
    script_name  = 'prey-agent',
    root_path    = system.paths.current,
    bin_path     = system.paths.current_bin;

var debug        = false;

var distros = {
  debian: {
    load: 'update-rc.d $1 defaults',
    unload: 'update-rc.d -f $1 remove',
    path: '/etc/init.d'
  },
  ubuntu: {
    load: 'service $1 start',
    unload: 'service $1 stop',
    path: '/etc/init',
    script_ext: '.conf'
  },
  redhat: {
    load: 'chkconfig $1 on',
    unload: 'chkconfig $1 off',
    path: '/etc/rc.d/init.d'
  },
  suse: {
    load: 'chkconfig --add $1',
    unload: 'chkconfig --del $1',
    path: '/etc/init.d'
  }
};

distros.fedora        = distros.redhat;
distros.linuxmint     = distros.ubuntu;
distros.elementary_os = distros.ubuntu;

/////////////////////////////////////////////////
// helpers
/////////////////////////////////////////////////

var log = function(str){
  if (debug) console.log(str);
}

var get_init_script_path = function(distro){
  var init_path = distros[distro].path;
  return path.join(init_path, script_name);
};

var copy_init_script = function(distro, callback){
  var full_path = get_init_script_path(distro),
      script_template = path.join(__dirname, script_name);

  if (distros[distro].script_ext)
    script_template = script_template + distros[distro].script_ext;

  log('Loading script template: ' + script_template);
  fs.readFile(script_template, function(err, template){
    if (err) return callback(err);

    var data = template.toString()
               .replace(/{{root_path}}/g, root_path)
               .replace(/{{prey_bin}}/g, bin_path)
               .replace(/{{user}}/g, running_user);

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

var run_init_command = function(cmd, distro, cb){
  var distro_conf = distros[distro];
  var command = distro_conf[cmd].replace('$1', script_name);
  log('Running command: ' + command);;
  exec(command, cb);
}

var load_init_script = function(distro, cb){
  run_init_command('load', distro, cb);
};

var unload_init_script = function(distro, cb){
  // if service is not running, we will get an error, but that shouldn't
  // stop the process from finalizing
  run_init_command('unload', distro, function(err){
    // if (err) console.log(err);
    cb();
  });
};

/////////////////////////////////////////////////
// hooks
/////////////////////////////////////////////////

exports.post_install = function(callback) {
  system.get_os_name(function(err, name) {
    if (err) return callback(err);

    var distro = name.toLowerCase().replace(' ', '_');

    log('Removing init script');
    remove_init_script(distro, function(err){
     if (err && err.code !== 'ENOENT')
       return callback(err);

    log('Setting up init script.');
     copy_init_script(distro, function(err){
        if (err) return callback(err);

        log('Loading init script.');
        load_init_script(distro, callback);
      });
    });

  });
};

exports.pre_uninstall = function(callback){
  system.get_os_name(function(err, name){
    if (err) return callback(err);

    var distro = name.toLowerCase().replace(' ', '_');

    log('Unloading init script.');
    unload_init_script(distro, function(err){
      if (err) return callback(err);

      log('Removing init script.');
      remove_init_script(distro, function(err){
        if (!err || err.code === 'ENOENT') callback();
        else callback(err);
      });
    });
  });
};
