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
  if (debug)
    console.log(str);
}

var get_init_script_path = function(distro){
  var init_path = distros[distro].path;
  return path.join(init_path, script_name);
};

var copy_init_script = function(distro, cb){
  var full_path = get_init_script_path(distro),
      script_template = path.join(__dirname, script_name);

  // add .conf to script_template and full_path variables, if needed
  if (distros[distro].script_ext) {
    full_path       = full_path + distros[distro].script_ext;
    script_template = script_template + distros[distro].script_ext;
  }

  log('Loading script template: ' + script_template);
  fs.readFile(script_template, function(err, template){
    if (err) return cb(err);

    var data = template.toString()
               .replace(/{{root_path}}/g, root_path)
               .replace(/{{prey_bin}}/g, bin_path)
               .replace(/{{user}}/g, running_user);

    if (data === template.toString())
      return cb(new Error("Unable to replace template variables!"));

    fs.writeFile(full_path, data, function(err){
      if (err) return cb(err);
      fs.chmod(full_path, 0755, cb);
    });
  });

};

var remove_init_script = function(distro, cb){
  var file = get_init_script_path(distro);
  fs.unlink(file, cb);
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

var unload_remove = function(distro, cb) {
  log('Unloading init script.');
  unload_init_script(distro, function(err){
    if (err) return cb(err);

    log('Removing init script.');
    remove_init_script(distro, function(err){
      if (!err || err.code === 'ENOENT') cb();
      else cb(err);
    });
  });
}

/////////////////////////////////////////////////
// hooks
/////////////////////////////////////////////////

exports.post_install = function(cb) {
  system.get_os_name(function(err, name) {
    if (err) return cb(err);

    console.log('Distro detected: ' + name);
    var distro = name.toLowerCase().replace(' ', '_');

    unload_remove(distro, function(err) {
      if (err) log(err.message);

      log('Setting up init script.');
      copy_init_script(distro, function(err){
        if (err) return cb(err);

        log('Loading init script.');
        load_init_script(distro, cb);
      });

    })

  });
};

exports.pre_uninstall = function(cb){
  system.get_os_name(function(err, name){
    if (err) return cb(err);

    console.log('Distro detected: ' + name);
    var distro = name.toLowerCase().replace(' ', '_');
    unload_remove(distro, cb);
  });
};

exports.post_activate = function(cb) {
  cb();
}
