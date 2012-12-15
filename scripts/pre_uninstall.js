#!/usr/bin/env node

var exec = require('child_process').exec,
    os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    join = require("path").join,
    prey_bin = join(__dirname, "..", "bin", "prey"),
    args = ['config', 'deactivate'];

var pre_uninstall = function() {

  exec(prey_bin + " " + args.join(" "), function(err, stdout, stderr){
    if (stdout.length > 0) console.log(stdout);
    if (stderr.length > 0) console.log(stderr);

    if (err) {
      console.log(err);
      process.exit(1);
    }
  });
}

pre_uninstall();
