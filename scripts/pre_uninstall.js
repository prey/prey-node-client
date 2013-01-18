#!/usr/bin/env node

var join = require('path').join,
    execFile = require('child_process').execFile,
    prey_bin = join(__dirname, '..', 'bin', 'prey'),
    args = ['config', 'hooks', 'pre_uninstall'];

var pre_uninstall = function() {
  execFile(prey_bin, args, function(err, stdout, stderr){
    if (stdout.length > 0) console.log(stdout.trim());
    if (stderr.length > 0) console.log(stderr.trim());

    if (err) {
      // console.log(err);
      process.exit(1);
    }
  });
}

pre_uninstall();
