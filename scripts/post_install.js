#!/usr/bin/env node

// this script is executed by npm after an 'npm install prey'
// and calls the conf module to set up config and execution triggers

var fs          = require('fs'),
    join        = require('path').join,
    execFile    = require('child_process').execFile,
    bin_path    = join(__dirname, '..', 'bin'),
    prey_bin    = join(bin_path, 'prey'),
    args        = ['config', 'hooks', 'post_install'],
    is_windows  = process.platform === 'win32';

if (is_windows) prey_bin += '.cmd';

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

var post_install = function() {

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

  execFile(prey_bin, args, function(err, stdout, stderr) {
    if (stdout.length > 0) console.log(stdout.trim());
    if (stderr.length > 0) console.log(stderr.trim());
    if (err) return console.log(err);
    console.log("System setup successful! Please run 'bin/prey config activate --gui' to finish the installation.");
  });

}

if (!process.env.BUNDLE_ONLY) {
  check_shebang(function(err) {
    if (err) throw err;
    post_install();
  });
}
