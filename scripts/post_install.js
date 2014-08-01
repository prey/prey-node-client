#!/usr/bin/env node

// this script is executed by npm after an 'npm install prey'
// and calls the conf module to set up config and execution triggers

var fs          = require('fs'),
    join        = require('path').join,
    execFile    = require('child_process').execFile,
    bin_path    = join(__dirname, '..', 'bin'),
    prey_bin    = join(bin_path, 'prey'),
    is_windows  = process.platform === 'win32';

var args = {
  post_install  : ['config', 'hooks', 'post_install'],
  activate      : ['config', 'activate']
}

if (is_windows) prey_bin += '.cmd';

var run = function(args, cb) {
  execFile(prey_bin, args, function(err, stdout, stderr) {
    if (stdout.length > 0) console.log(stdout.trim());
    if (stderr.length > 0) console.log(stderr.trim());

    cb(err);
  });
}

var line = '\n=====================================================\n';

var check_shebang = function(cb) {
  if (is_windows) 
    return cb();

  var node_bin = join(bin_path, 'node');
  fs.exists(node_bin, function(exists) {
    if (exists) return cb();

    fs.readFile(prey_bin, function(err, data) {
      if (err) return cb(err);
      
      // replace relative shebang with regular, system-wide one
      var str = data.toString().replace(/^#! bin\/node/, '#!/usr/bin/env node');
      if (str == data.toString())
        return cb();

      fs.writeFile(prey_bin, str, cb);
    })
  })
}

// installation hooks need to be set as the root user
var run_hooks = function(cb) {

  if (!is_windows) {
    if (process.getuid && process.getuid() != 0) {
      var msg =  'You are running this script as an unprivileged user';
         msg +=  '\nso we cannot continue with the system configuration.';
         msg +=  '\nTo finalize the install process please run: \n\n';
         msg +=  '  $ sudo scripts/post_install.js';
      console.log(line + msg + line);
      process.exit();
    }
  }

  run(args.post_install, cb);
}

var activate = function(cb) {
  run(args.activate, cb);
}

var post_install = function() {
  check_shebang(function(err) {
    if (err) throw err;

    run_hooks(function(err) {
      if (err) throw err;

      activate(function(err) {
        if (!err)
          console.log("All good! Please run 'prey config' to finish installation.");
      });
    });
  });
}

if (!process.env.BUNDLE_ONLY) {
  post_install()
}
